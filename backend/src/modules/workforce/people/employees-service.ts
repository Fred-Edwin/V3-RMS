import type { HrDocumentType } from '@prisma/client';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../utils/errors';
import { uploadImageBuffer } from '../../../utils/cloudinary';
import { runAudited } from '../_shared/audit/audit-writer';
import type { JsonValue } from '../_shared/audit/audit.types';
import {
  daysBetween,
  fromDateColumn,
  nairobiDateOf,
  nairobiToday,
  parseNairobiDate,
  toDateColumn,
  type NairobiDate,
} from '../_shared/time/nairobi-time';
import {
  assertInScope,
  inScope,
  lockedGroupsFor,
  redactSensitive,
  scopeOf,
  workforceCan,
  type AccessSubject,
  type AccessTarget,
  type SensitiveGroup,
} from '../_shared/workforce-access';
import { getEffectiveRuleGroup } from '../rules/rules-service';
import {
  employeesRepository,
  type FileRow,
  type ListRow,
  type ScopeFilter,
} from './employees-repository';
import { resolveActor, told, type ActorCtx } from './people-context';
import {
  checklistPercent,
  checklistRows,
  fileParts,
  gapsOf,
  NEEDS_FINISHING_PARTS,
  ringPercent,
  type FileFacts,
  type FilePart,
} from './people-completeness';
import { canUndoExit, undoUntil } from './people-dates';
import { presentField } from './people-masking';
import {
  EXIT_REASONS,
  EXIT_UNDO_DAYS,
  HIRE_LOGIN_ROLES,
  PAY_CHANGE_REASONS,
  PROBATION_VERDICTS,
  REVEALABLE_FIELDS,
  SELF_UPLOADABLE_DOCUMENT_TYPES,
  type ExitReason,
  type FileRequestKind,
  type PayChangeReason,
  type ProbationVerdict,
} from './people.constants';
import type {
  ContractStatusCode,
  DocumentRow,
  EmployeeActions,
  EmployeeFileView,
  EmployeeListRow,
  EmploymentStatusCode,
  ExitView,
  FileRequestRow,
  ListResponse,
  Lookups,
  PeopleSummary,
  Pagination,
  ProbationView,
  TimelineEvent,
  NextStep,
  UnlinkedAccount,
} from './people.types';
import type { ListQuerySchema } from './people-validators';
import type { z } from 'zod';

export type ListQuery = z.infer<typeof ListQuerySchema>;

// ---- shared helpers (also used by the hire, pay and lifecycle services) -----------------------------------------------

export const todayOf = (now: Date = new Date()): NairobiDate => nairobiToday(now);

export const targetOf = (row: { userId: string | null; siteId: string; departmentId: string | null; department?: { key: AccessTarget['departmentTag'] } | null }): AccessTarget => ({
  userId: row.userId,
  siteId: row.siteId,
  departmentId: row.departmentId,
  departmentTag: row.department?.key ?? null,
});

const pagination = (total: number, page: number, perPage: number): Pagination => ({ total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) });

const dateOrNull = (value: Date | null): NairobiDate | null => (value ? fromDateColumn(value) : null);
const instantDate = (value: Date | null): NairobiDate | null => (value ? nairobiDateOf(value) : null);

/** What the viewer's read scope lets them list. Null means no read capability at all. */
export function readScopeOf(subject: AccessSubject): ScopeFilter {
  const scope = scopeOf(subject, 'employee.read_basic');
  switch (scope) {
    case 'all':
      return { kind: 'all' };
    case 'unit':
      if (!subject.siteId) throw new ForbiddenError('You do not have permission to perform this action');
      return { kind: 'site', siteId: subject.siteId };
    case 'dept':
      return { kind: 'departments', departmentIds: subject.headOfDepartmentIds ?? [] };
    default:
      throw new ForbiddenError('You do not have permission to perform this action');
  }
}

/** A manager (unit scope) edits a file only while it is onboarding; HR and the System Admin always (question 2). */
export function assertCanEditBasics(subject: AccessSubject, row: { userId: string | null; siteId: string; departmentId: string | null; status: string; department?: { key: AccessTarget['departmentTag'] } | null }): void {
  const scope = scopeOf(subject, 'employee.write_basic');
  if (scope === null) throw new ForbiddenError('You do not have permission to perform this action');
  assertInScope(subject, 'employee.write_basic', targetOf(row));
  if (row.status === 'EXITED') throw new ConflictError('This file is closed', 'ALREADY_EXITED');
  if (scope !== 'all' && row.status !== 'ONBOARDING') {
    throw new ForbiddenError('Ask HR to change this file', 'FILE_LOCKED_FOR_EDIT');
  }
}

const factsOf = (source: {
  payType: string;
  nationalId: string | null;
  personalPhone: string | null;
  physicalAddress: string | null;
  positionId: string | null;
  departmentId: string | null;
  userId: string | null;
  nssfNumber: string | null;
  shaNumber: string | null;
  photoUrl: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  contractStatus: string;
  payProfile: { amount: unknown; payoutMethod: string | null; bankName: string | null; accountNumber: string | null; mpesaPhone: string | null } | null;
}): FileFacts => {
  const p = source.payProfile;
  const payoutComplete =
    p?.payoutMethod === 'BANK' ? !!p.bankName && !!p.accountNumber : p?.payoutMethod === 'MPESA' ? !!p.mpesaPhone : p?.payoutMethod === 'CASH';
  return {
    casual: source.payType === 'DAILY_RATE',
    hasNationalId: !!source.nationalId,
    hasPhone: !!source.personalPhone,
    hasPosition: !!source.positionId,
    hasDepartment: !!source.departmentId,
    payAmountSet: p?.amount !== null && p?.amount !== undefined,
    payoutComplete: payoutComplete === true,
    hasLogin: !!source.userId,
    hasNssf: !!source.nssfNumber,
    hasSha: !!source.shaNumber,
    hasPhoto: !!source.photoUrl,
    hasPersonalDetails: !!source.personalPhone && !!source.physicalAddress,
    hasEmergencyContact: !!source.emergencyName && !!source.emergencyPhone,
    contractActive: source.contractStatus === 'ACTIVE',
  };
};

const employmentOf = (payType: string): 'MONTHLY' | 'CASUAL' => (payType === 'DAILY_RATE' ? 'CASUAL' : 'MONTHLY');

function listRowOf(subject: AccessSubject, row: ListRow): { view: EmployeeListRow; gaps: FilePart[] } {
  const target: AccessTarget = { userId: row.userId, siteId: row.siteId, departmentId: row.departmentId };
  const locked = lockedGroupsFor(subject, target);
  const gaps = gapsOf(fileParts(factsOf(row)), locked);
  return {
    gaps,
    view: {
      id: row.id,
      employeeNumber: row.employeeNumber,
      name: row.name,
      photoUrl: row.photoUrl,
      positionName: row.position?.name ?? null,
      siteId: row.siteId,
      siteName: row.site.name,
      departmentId: row.departmentId,
      departmentName: row.department?.name ?? null,
      employment: employmentOf(row.payType),
      contractStatus: row.contractStatus as ContractStatusCode,
      status: row.status as EmploymentStatusCode,
      probationEndsOn: dateOrNull(row.probationEndsOn),
      gaps,
      reportsToName: row.reportsTo?.name ?? null,
      isHead: row.heads.length > 0,
    },
  };
}

// ---- the file view ------------------------------------------------------------------------------------------------

const IDS_KEYS = REVEALABLE_FIELDS.ids;
const BANK_KEYS = REVEALABLE_FIELDS.bank;

/** The raw value of a revealable field on a file row. */
export function rawField(row: FileRow, field: string): string | null {
  const p = row.payProfile;
  switch (field) {
    case 'nationalId':
      return row.nationalId;
    case 'kraPin':
      return row.kraPin;
    case 'shaNumber':
      return row.shaNumber;
    case 'nssfNumber':
      return row.nssfNumber;
    case 'helbNumber':
      return row.helbNumber;
    case 'dateOfBirth':
      return row.dateOfBirth ? fromDateColumn(row.dateOfBirth) : null;
    case 'physicalAddress':
      return row.physicalAddress;
    case 'bankName':
      return p?.bankName ?? null;
    case 'bankBranch':
      return p?.bankBranch ?? null;
    case 'accountName':
      return p?.accountName ?? null;
    case 'accountNumber':
      return p?.accountNumber ?? null;
    case 'mpesaPhone':
      return p?.mpesaPhone ?? null;
    default:
      return null;
  }
}

async function buildFileView(subject: AccessSubject, row: FileRow, today: NairobiDate): Promise<EmployeeFileView> {
  const target = targetOf(row);
  const own = row.userId !== null && row.userId === subject.id;
  const locked = lockedGroupsFor(subject, target);

  const record: Record<string, string | null> = { payoutMethod: row.payProfile?.payoutMethod ?? null };
  for (const key of [...IDS_KEYS, ...BANK_KEYS]) record[key] = presentField(key, rawField(row, key), own);
  const redacted = redactSensitive(subject, target, record, { ids: IDS_KEYS, bank: [...BANK_KEYS, 'payoutMethod'] });

  const states = fileParts(factsOf(row));
  const canSeeCompleteness = !locked.includes('pay') && !locked.includes('bank') && !locked.includes('ids');
  const rows = checklistRows(states);

  const spell = row.spells[0];
  const rule = await getEffectiveRuleGroup(row.siteId, today, 'PROBATION');
  const authorIds = [...row.probationNotes.map((n) => n.authorId), ...(spell?.endedById ? [spell.endedById] : [])];
  const names = new Map((await employeesRepository.findUserNames([...new Set(authorIds)])).map((u) => [u.id, u.name]));

  const probationEndsOn = dateOrNull(row.probationEndsOn);
  const startDate = fromDateColumn(row.startDate);
  const probation: ProbationView | null = probationEndsOn
    ? {
        endsOn: probationEndsOn,
        totalDays: daysBetween(startDate, probationEndsOn) + 1,
        dayNumber: Math.min(daysBetween(startDate, probationEndsOn) + 1, Math.max(1, daysBetween(startDate, today) + 1)),
        daysLeft: Math.max(0, daysBetween(today, probationEndsOn)),
        extensions: row.probationExtensions,
        extensionsAllowed: rule.values.maxExtensions,
        decidedOn: dateOrNull(row.probationDecidedOn),
        confirmedOn: dateOrNull(row.probationConfirmedOn),
        confirmationWaitingForContract: row.probationDecidedOn !== null && row.probationConfirmedOn === null,
        notes: row.probationNotes.map((n) => ({
          authorName: names.get(n.authorId) ?? 'Unknown',
          authorKind: n.authorKind as 'HEAD' | 'BRANCH_MANAGER' | 'HR',
          verdict: n.verdict as ProbationVerdict,
          note: n.note,
          createdOn: nairobiDateOf(n.createdAt),
        })),
      }
    : null;

  const status = row.status as EmploymentStatusCode;
  let exit: ExitView | null = null;
  if ((status === 'NOTICE' || status === 'EXITED') && spell?.endedOn) {
    const lastDay = fromDateColumn(spell.endedOn);
    const undoable = canUndoExit(lastDay, today);
    exit = {
      lastDay,
      reason: (spell.exitReason ?? 'OTHER') as ExitReason,
      note: spell.exitNote,
      uniformReturned: spell.uniformReturned,
      exitedByName: spell.endedById ? (names.get(spell.endedById) ?? null) : null,
      recordedOn: instantDate(spell.endedAt),
      finalized: spell.finalizedAt !== null,
      undoUntil: undoUntil(lastDay),
      canUndo: undoable,
      canRehire: status === 'EXITED' && !undoable,
    };
  }

  const siteNames = await employeesRepository.siteNames(row.moves.flatMap((m) => [m.fromSiteId, m.toSiteId]));
  const activeLoan = row.moves.find((m) => m.kind === 'LOAN' && m.status === 'ACTIVE');
  const scheduled = row.moves.find((m) => m.status === 'SCHEDULED');

  const canSeePay = !locked.includes('pay');
  const canSeeDocs = !locked.includes('documents');
  const timeline: TimelineEvent[] = [];
  row.spells.forEach((s, index, all) => {
    const isFirst = index === all.length - 1;
    timeline.push({ on: fromDateColumn(s.startsOn), kind: isFirst ? 'HIRED' : 'REHIRE', detail: {} });
    if (s.endedOn) timeline.push({ on: fromDateColumn(s.endedOn), kind: 'EXIT', detail: { reason: s.exitReason } });
  });
  for (const m of row.moves.filter((x) => x.status === 'DONE' || x.status === 'ACTIVE')) {
    timeline.push({ on: fromDateColumn(m.startsOn), kind: m.kind, detail: { toSite: siteNames.get(m.toSiteId) ?? null } });
  }
  for (const c of row.contracts) timeline.push({ on: fromDateColumn(c.startsOn), kind: 'CONTRACT', detail: { type: c.contractType?.name ?? null } });
  if (row.probationDecidedOn) timeline.push({ on: fromDateColumn(row.probationDecidedOn), kind: 'PROBATION', detail: {} });
  if (canSeePay) {
    for (const p of row.payChanges.filter((x) => x.status === 'APPROVED')) {
      timeline.push({ on: fromDateColumn(p.effectiveFrom), kind: 'PAY_CHANGE', detail: { reason: p.reason } });
    }
  }
  if (canSeeDocs) for (const d of row.documents) timeline.push({ on: nairobiDateOf(d.createdAt), kind: 'DOCUMENT', detail: { type: d.documentType } });
  timeline.sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : 0));

  const nextSteps: NextStep[] = [];
  if (probation && probation.decidedOn === null && status !== 'EXITED' && probation.daysLeft <= 14) {
    nextSteps.push({ code: 'PROBATION_DECISION', dueOn: probation.endsOn });
  }
  if (row.payType === 'MONTHLY_SALARY' && row.contractStatus !== 'ACTIVE' && status !== 'EXITED') nextSteps.push({ code: 'CREATE_CONTRACT', dueOn: null });
  for (const request of row.fileRequests) nextSteps.push({ code: 'FILE_REQUEST', dueOn: null, fileRequestId: request.id });
  if (canSeeCompleteness && gapsOf(states, locked).some((part) => (NEEDS_FINISHING_PARTS as readonly string[]).includes(part)) && status !== 'EXITED') {
    nextSteps.push({ code: 'FINISH_FILE', dueOn: null });
  }

  const lifecycle = inScope(subject, 'employee.lifecycle', target);
  const notExited = status !== 'EXITED';
  const canEditBasics = (() => {
    try {
      assertCanEditBasics(subject, row);
      return true;
    } catch {
      return false;
    }
  })();
  const actions: EmployeeActions = {
    editJob: canEditBasics,
    changePay: inScope(subject, 'payprofile.write', target) && notExited,
    transfer: lifecycle && notExited,
    sendToSite: lifecycle && notExited && row.payType === 'MONTHLY_SALARY',
    exit: lifecycle && notExited && status !== 'NOTICE',
    undoExit: lifecycle && (status === 'NOTICE' || status === 'EXITED') && !!exit?.canUndo,
    rehire: lifecycle && !!exit?.canRehire,
    decideProbation: lifecycle && notExited && probation !== null && probation.confirmedOn === null,
    writeNote: inScope(subject, 'probation.note', target) && notExited && probation !== null,
    createContract: inScope(subject, 'employee.write_sensitive', target) && notExited && row.payType === 'MONTHLY_SALARY' && row.contractStatus !== 'ACTIVE',
    uploadDocument: (inScope(subject, 'employee.write_sensitive', target) || (own && workforceCan(subject, 'me.file'))) && notExited,
    remind: inScope(subject, 'employee.write_basic', target) && notExited && !own,
    createLogin: lifecycle && notExited && row.userId === null && row.payType === 'MONTHLY_SALARY',
  };

  return {
    id: row.id,
    employeeNumber: row.employeeNumber,
    name: row.name,
    photoUrl: row.photoUrl,
    status,
    employment: employmentOf(row.payType),
    contractStatus: row.contractStatus as ContractStatusCode,
    tracksTime: row.tracksTime,
    tracksTimeFromPosition: !row.tracksTimeOverride,
    site: { id: row.site.id, name: row.site.name },
    department: row.department ? { id: row.department.id, name: row.department.name } : null,
    position: row.position ? { id: row.position.id, name: row.position.name } : null,
    reportsTo: row.reportsTo ? { id: row.reportsTo.id, name: row.reportsTo.name, isHead: row.reportsTo.heads.length > 0 } : null,
    startDate,
    hasLogin: row.userId !== null,
    loginRole: row.user?.role ?? null,
    isHead: row.heads.length > 0,
    personalPhone: row.personalPhone,
    personalEmail: row.personalEmail,
    emergencyContact: row.emergencyName && row.emergencyPhone ? { name: row.emergencyName, relation: row.emergencyRelation, phone: row.emergencyPhone } : null,
    sensitive: redacted.data as Partial<Record<string, string | null>>,
    locked: redacted.locked,
    completeness: canSeeCompleteness
      ? { ringPercent: ringPercent(states), checklistPercent: checklistPercent(rows), parts: states, checklist: rows }
      : null,
    probation,
    exit,
    nextSteps,
    timeline,
    actions,
    loan: activeLoan
      ? { hostSiteName: siteNames.get(activeLoan.toSiteId) ?? '', from: fromDateColumn(activeLoan.startsOn), until: dateOrNull(activeLoan.endsOn) }
      : null,
    scheduledMove: scheduled
      ? { kind: scheduled.kind, startsOn: fromDateColumn(scheduled.startsOn), toSiteName: siteNames.get(scheduled.toSiteId) ?? '' }
      : null,
  };
}

/** Loads a file the subject may read (out of scope answers 404) and returns its row. */
export async function loadReadableRow(ctx: ActorCtx, id: string, today: NairobiDate): Promise<FileRow> {
  const row = await employeesRepository.findFileById(ctx.companyId, id, toDateColumn(today));
  if (!row) throw new NotFoundError('Employee not found');
  const target = targetOf(row);
  if (!inScope(ctx.subject, 'employee.read_basic', target) && !inScope(ctx.subject, 'me.file', target)) throw new NotFoundError('Employee not found');
  return row;
}

// ---- the service ------------------------------------------------------------------------------------------------

const changedNames = (fields: Record<string, unknown>): string[] => Object.keys(fields);

const SELF_KINDS: Record<string, FileRequestKind> = {
  emergencyName: 'EMERGENCY_CONTACT',
  emergencyRelation: 'EMERGENCY_CONTACT',
  emergencyPhone: 'EMERGENCY_CONTACT',
  nssfNumber: 'NSSF_SHA',
  shaNumber: 'NSSF_SHA',
  personalPhone: 'PHOTO_AND_DETAILS',
  physicalAddress: 'PHOTO_AND_DETAILS',
  nationalId: 'ID_NUMBER',
};
const STATUTORY_FIELDS = ['nssfNumber', 'shaNumber', 'helbNumber', 'kraPin'] as const;

/** Only these may be changed under `employee.write_basic`; the rest need `employee.write_sensitive`. */
const BASIC_FIELDS = ['name', 'positionId', 'reportsToId', 'tracksTime', 'personalPhone', 'personalEmail', 'emergencyName', 'emergencyRelation', 'emergencyPhone'] as const;
/** Values safe to put in an audit entry (no ID, address, phone or statutory number). */
const AUDIT_VALUE_FIELDS = ['name', 'positionId', 'reportsToId', 'tracksTime'] as const;

type EditInput = Partial<Record<string, string | boolean | null>>;

const toDbFields = (input: EditInput): Record<string, unknown> => {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    data[key] = key === 'dateOfBirth' ? (value === null ? null : toDateColumn(parseNairobiDate(String(value)))) : value;
  }
  return data;
};

export const employeesService = {
  async list(subject: AccessSubject, query: ListQuery): Promise<ListResponse<EmployeeListRow>> {
    const ctx = await resolveActor(subject);
    const scope = readScopeOf(subject);
    const today = todayOf();
    const base = {
      companyId: ctx.companyId,
      scope,
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      filter: query.filter,
      ...(query.q ? { q: query.q } : {}),
      today: toDateColumn(today),
    };
    if (query.filter === 'needs_finishing') {
      const all = (await employeesRepository.listAll(base)).map((row) => listRowOf(subject, row));
      const matches = all.filter((r) => r.gaps.some((g) => (NEEDS_FINISHING_PARTS as readonly string[]).includes(g)));
      const start = (query.page - 1) * query.perPage;
      return { success: true, data: matches.slice(start, start + query.perPage).map((r) => r.view), pagination: pagination(matches.length, query.page, query.perPage) };
    }
    const { rows, total } = await employeesRepository.list(base, query.page, query.perPage);
    return { success: true, data: rows.map((row) => listRowOf(subject, row).view), pagination: pagination(total, query.page, query.perPage) };
  },

  async summary(subject: AccessSubject, siteId: string | undefined): Promise<PeopleSummary> {
    const ctx = await resolveActor(subject);
    const scope = readScopeOf(subject);
    const today = todayOf();
    const monthStart = parseNairobiDate(`${today.slice(0, 7)}-01`);
    const counts = await employeesRepository.summary(ctx.companyId, scope, siteId, toDateColumn(today), toDateColumn(monthStart));
    const list = await employeesRepository.listAll({ companyId: ctx.companyId, scope, ...(siteId ? { siteId } : {}), filter: 'needs_finishing', today: toDateColumn(today) });
    const needsFinishing = list.map((row) => listRowOf(subject, row)).filter((r) => r.gaps.some((g) => (NEEDS_FINISHING_PARTS as readonly string[]).includes(g))).length;
    return { ...counts, needsFinishing };
  },

  async lookups(subject: AccessSubject): Promise<Lookups> {
    if (!workforceCan(subject, 'employee.read_basic') && !workforceCan(subject, 'org.read')) throw new ForbiddenError('You do not have permission to perform this action');
    const ctx = await resolveActor(subject);
    const scope = scopeOf(subject, 'employee.read_basic') ?? scopeOf(subject, 'org.read');
    const sites = (await employeesRepository.sitesOfCompany(ctx.companyId)).filter((s) => scope === 'all' || s.id === subject.siteId);
    const [departments, positions, contractTypes] = await Promise.all([
      employeesRepository.departmentsOfCompany(ctx.companyId, sites.map((s) => s.id)),
      employeesRepository.positionsOfCompany(ctx.companyId),
      employeesRepository.contractTypesOfCompany(ctx.companyId),
    ]);
    const ruleSite = sites[0]?.id ?? subject.siteId;
    const rule = ruleSite ? (await getEffectiveRuleGroup(ruleSite, todayOf(), 'PROBATION')).values : { defaultMonths: 0, maxExtensions: 0, maxExtensionMonths: 0 };
    return {
      sites: sites.map((s) => ({ id: s.id, name: s.name, type: s.type, isHub: s.isHub })),
      departments: departments.map((d) => ({ id: d.id, siteId: d.siteId, name: d.name, inventoryTag: d.key, isActive: d.status === 'ACTIVE' })),
      positions: positions.map((p) => ({
        id: p.id,
        name: p.name,
        defaultTracksTime: p.defaultTracksTime,
        loginRole: p.loginRole,
        casualsAllowed: p.casualsAllowed,
        departmentIds: p.departments.map((d) => d.departmentId),
        isActive: p.isActive,
      })),
      assignableLoginRoles: workforceCan(subject, 'employee.lifecycle') ? [...HIRE_LOGIN_ROLES] : [],
      exitReasons: [...EXIT_REASONS],
      payChangeReasons: [...PAY_CHANGE_REASONS],
      probationVerdicts: [...PROBATION_VERDICTS],
      contractTypes,
      probationRule: { defaultMonths: rule.defaultMonths, maxExtensions: rule.maxExtensions, maxExtensionMonths: rule.maxExtensionMonths },
      exitUndoDays: EXIT_UNDO_DAYS,
    };
  },

  /** Booleans only, never a name (R4). */
  async duplicateCheck(subject: AccessSubject, input: { nationalId?: string; phone?: string; email?: string }) {
    const ctx = await resolveActor(subject);
    const [nationalId, phone, email] = await Promise.all([
      input.nationalId ? employeesRepository.nationalIdTaken(ctx.companyId, input.nationalId) : false,
      input.phone ? employeesRepository.phoneTaken(ctx.companyId, input.phone) : false,
      input.email ? employeesRepository.emailTaken(input.email) : false,
    ]);
    return { nationalId, phone, email };
  },

  async unlinkedAccounts(subject: AccessSubject, page: number, perPage: number): Promise<ListResponse<UnlinkedAccount>> {
    const ctx = await resolveActor(subject);
    const { rows, total } = await employeesRepository.unlinkedAccounts(ctx.companyId, page, perPage);
    return {
      success: true,
      data: rows.map((u) => ({ userId: u.id, name: u.name, email: u.email, role: u.role, siteName: u.site?.name ?? null, createdOn: nairobiDateOf(u.createdAt) })),
      pagination: pagination(total, page, perPage),
    };
  },

  async getMine(subject: AccessSubject): Promise<EmployeeFileView> {
    const ctx = await resolveActor(subject);
    const today = todayOf();
    const row = await employeesRepository.findFileByUserId(ctx.companyId, subject.id, toDateColumn(today));
    if (!row) throw new NotFoundError('You do not have a file yet');
    return buildFileView(subject, row, today);
  },

  async getFile(subject: AccessSubject, id: string): Promise<EmployeeFileView> {
    const ctx = await resolveActor(subject);
    const today = todayOf();
    const row = await loadReadableRow(ctx, id, today);
    return buildFileView(subject, row, today);
  },

  /** Used by the write services to answer with the fresh file after their transaction commits. */
  async viewAfterWrite(subject: AccessSubject, id: string): Promise<EmployeeFileView> {
    return employeesService.getFile(subject, id);
  },

  // ---- documents ------------------------------------------------------------------------------------------------
  async documents(subject: AccessSubject, id: string): Promise<DocumentRow[] | { locked: SensitiveGroup[] }> {
    const ctx = await resolveActor(subject);
    const row = await loadReadableRow(ctx, id, todayOf());
    const locked = lockedGroupsFor(subject, targetOf(row));
    if (locked.includes('documents')) return { locked };
    const docs = await employeesRepository.documentsOf(row.id);
    const names = new Map((await employeesRepository.findUserNames([...new Set(docs.map((d) => d.uploadedById))])).map((u) => [u.id, u.name]));
    return docs.map((d) => ({ id: d.id, documentType: d.documentType, fileName: d.fileName, uploadedByName: names.get(d.uploadedById) ?? null, uploadedOn: nairobiDateOf(d.createdAt) }));
  },

  /** R10: the URL, behind an audit entry unless it is the person's own. */
  async openDocument(subject: AccessSubject, id: string, docId: string): Promise<{ url: string }> {
    const ctx = await resolveActor(subject);
    const row = await loadReadableRow(ctx, id, todayOf());
    if (lockedGroupsFor(subject, targetOf(row)).includes('documents')) throw new NotFoundError('Document not found');
    const doc = await employeesRepository.findDocument(row.id, docId);
    if (!doc) throw new NotFoundError('Document not found');
    const own = row.userId === subject.id;
    if (!own) {
      await runAudited(async () => ({
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: row.siteId,
            actor: ctx.auditActor,
            action: 'people.document_opened',
            category: 'SENSITIVE_VIEW',
            subjectType: 'Employee',
            subjectId: row.id,
            subjectUserId: row.userId,
            after: { documentType: doc.documentType },
          },
        ],
      }));
    }
    return { url: doc.fileUrl };
  },

  async uploadDocument(subject: AccessSubject, id: string, input: { documentType: HrDocumentType; fileName: string; buffer: Buffer }): Promise<DocumentRow> {
    const ctx = await resolveActor(subject);
    const today = todayOf();
    const row = await employeesRepository.findFileById(ctx.companyId, id, toDateColumn(today));
    if (!row) throw new NotFoundError('Employee not found');
    const target = targetOf(row);
    const own = row.userId !== null && row.userId === subject.id;
    if (inScope(subject, 'employee.write_sensitive', target)) {
      // HR may upload every document type.
    } else if (own && workforceCan(subject, 'me.file')) {
      if (!(SELF_UPLOADABLE_DOCUMENT_TYPES as readonly string[]).includes(input.documentType)) {
        throw new ForbiddenError(`Document type ${input.documentType} can only be uploaded by HR`, 'FIELD_NOT_ALLOWED');
      }
    } else {
      throw new NotFoundError('Employee not found');
    }
    const fileUrl = await uploadImageBuffer(input.buffer, 'hr-documents');
    return runAudited(async (tx) => {
      const doc = await employeesRepository.createDocument(tx, {
        employeeId: row.id,
        legacyProfileId: row.legacyProfileId,
        documentType: input.documentType,
        fileName: input.fileName,
        fileUrl,
        uploadedById: subject.id,
      });
      return {
        result: { id: doc.id, documentType: doc.documentType, fileName: doc.fileName, uploadedByName: ctx.name, uploadedOn: nairobiDateOf(doc.createdAt) },
        entries: [
          {
            companyId: ctx.companyId,
            siteId: row.siteId,
            actor: ctx.auditActor,
            action: 'people.document_uploaded',
            category: 'PEOPLE',
            subjectType: 'Employee',
            subjectId: row.id,
            subjectUserId: row.userId,
            after: { documentType: doc.documentType },
          },
        ],
      };
    });
  },

  // ---- reveal ---------------------------------------------------------------------------------------------------
  async reveal(subject: AccessSubject, id: string, field: string): Promise<{ field: string; value: string | null }> {
    const ctx = await resolveActor(subject);
    const row = await loadReadableRow(ctx, id, todayOf());
    const group: SensitiveGroup = (IDS_KEYS as readonly string[]).includes(field) ? 'ids' : 'bank';
    const target = targetOf(row);
    if (lockedGroupsFor(subject, target).includes(group)) throw new ForbiddenError('You do not have permission to see this', 'FIELD_NOT_ALLOWED');
    const value = rawField(row, field);
    if (row.userId === subject.id) return { field, value };
    await runAudited(async () => ({
      result: null,
      entries: [
        {
          companyId: ctx.companyId,
          siteId: row.siteId,
          actor: ctx.auditActor,
          action: 'people.sensitive_revealed',
          category: 'SENSITIVE_VIEW',
          subjectType: 'Employee',
          subjectId: row.id,
          subjectUserId: row.userId,
          after: { field },
        },
      ],
    }));
    return { field, value };
  },

  // ---- edit (W6) -----------------------------------------------------------------------------------------------
  async update(subject: AccessSubject, id: string, input: EditInput): Promise<EmployeeFileView> {
    const ctx = await resolveActor(subject);
    const today = todayOf();
    const row = await employeesRepository.findFileById(ctx.companyId, id, toDateColumn(today));
    if (!row) throw new NotFoundError('Employee not found');
    const target = targetOf(row);
    if (!inScope(subject, 'employee.read_basic', target) && !inScope(subject, 'employee.write_basic', target)) throw new NotFoundError('Employee not found');

    const fields = Object.keys(input).filter((k) => input[k] !== undefined);
    const sensitiveKeys = fields.filter((k) => !(BASIC_FIELDS as readonly string[]).includes(k));
    if (sensitiveKeys.length > 0) {
      if (!inScope(subject, 'employee.write_sensitive', target)) throw new ForbiddenError('Only HR can change ID, statutory and address details', 'FIELD_NOT_ALLOWED');
    }
    if (fields.some((k) => (BASIC_FIELDS as readonly string[]).includes(k))) assertCanEditBasics(subject, row);
    if (row.status === 'EXITED') throw new ConflictError('This file is closed', 'ALREADY_EXITED');

    if (typeof input.nationalId === 'string' && input.nationalId !== row.nationalId && (await employeesRepository.nationalIdTaken(ctx.companyId, input.nationalId, row.id))) {
      throw new ConflictError('Someone on file already has this ID number', 'DUPLICATE_NATIONAL_ID');
    }

    const data: Record<string, unknown> = toDbFields(input);
    let tracksChange: boolean | null = null;
    if (typeof input.positionId === 'string') {
      const position = (await employeesRepository.positionsOfCompany(ctx.companyId)).find((p) => p.id === input.positionId);
      if (!position || !position.isActive) throw new ValidationError('That position is not available');
      if (row.departmentId && !position.departments.some((d) => d.departmentId === row.departmentId)) throw new ConflictError('That department does not offer this position', 'POSITION_NOT_OFFERED');
      if (row.payType === 'DAILY_RATE' && !position.casualsAllowed) throw new ConflictError('This position does not take casuals', 'CASUALS_NOT_ALLOWED');
      if (!row.tracksTimeOverride) {
        data.tracksTime = position.defaultTracksTime;
        if (data.tracksTime !== row.tracksTime) tracksChange = position.defaultTracksTime;
      }
    }
    if (typeof input.reportsToId === 'string') {
      if (input.reportsToId === row.id) throw new ValidationError('A person cannot report to themself');
      const boss = await employeesRepository.findFileById(ctx.companyId, input.reportsToId, toDateColumn(today));
      if (!boss || boss.status === 'EXITED') throw new ValidationError('That manager is not an active employee');
    }
    if (typeof input.tracksTime === 'boolean') {
      const positionDefault = row.position?.defaultTracksTime ?? null;
      data.tracksTimeOverride = positionDefault === null ? true : input.tracksTime !== positionDefault;
      if (input.tracksTime !== row.tracksTime) tracksChange = input.tracksTime;
    }

    const before: Record<string, JsonValue> = {};
    const after: Record<string, JsonValue> = {};
    for (const key of AUDIT_VALUE_FIELDS) {
      if (input[key] === undefined) continue;
      before[key] = (row as unknown as Record<string, JsonValue>)[key] ?? null;
      after[key] = input[key] ?? null;
    }
    const names = changedNames(input);

    await runAudited(async (tx) => {
      await employeesRepository.updateEmployee(tx, row.id, ctx.companyId, {
        ...data,
        ...(fields.some((k) => (STATUTORY_FIELDS as readonly string[]).includes(k)) ? { statutoryVerifiedAt: null, statutoryVerifiedById: null } : {}),
      });
      return {
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: row.siteId,
            actor: ctx.auditActor,
            action: 'people.updated',
            category: 'PEOPLE',
            subjectType: 'Employee',
            subjectId: row.id,
            subjectUserId: row.userId,
            before,
            after: { ...after, changed: names },
          },
        ],
        events:
          tracksChange === null
            ? []
            : [
                {
                  name: 'employee.tracks_time_changed' as const,
                  occurredAt: new Date().toISOString(),
                  payload: { employeeId: row.id, userId: row.userId, siteId: row.siteId, tracksTime: tracksChange, effectiveOn: today },
                },
              ],
      };
    });
    return employeesService.getFile(subject, id);
  },

  // ---- the person's own edit (W7) -------------------------------------------------------------------------------
  async patchMe(subject: AccessSubject, input: EditInput): Promise<EmployeeFileView> {
    const ctx = await resolveActor(subject);
    const today = todayOf();
    const row = await employeesRepository.findFileByUserId(ctx.companyId, subject.id, toDateColumn(today));
    if (!row) throw new NotFoundError('You do not have a file yet');
    if (row.status === 'EXITED') throw new ConflictError('This file is closed', 'ALREADY_EXITED');
    const fields = Object.keys(input).filter((k) => input[k] !== undefined);
    const kinds = [...new Set(fields.flatMap((k) => (SELF_KINDS[k] ? [SELF_KINDS[k]] : [])))];
    await runAudited(async (tx) => {
      await employeesRepository.updateEmployee(tx, row.id, ctx.companyId, {
        ...toDbFields(input),
        ...(fields.some((k) => (STATUTORY_FIELDS as readonly string[]).includes(k)) ? { statutoryVerifiedAt: null, statutoryVerifiedById: null } : {}),
      });
      if (kinds.length > 0) await employeesRepository.resolveFileRequests(tx, row.id, kinds, new Date());
      return {
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: row.siteId,
            actor: ctx.auditActor,
            action: 'people.self_updated',
            category: 'PEOPLE',
            subjectType: 'Employee',
            subjectId: row.id,
            subjectUserId: row.userId,
            after: { changed: changedNames(input) },
          },
        ],
      };
    });
    return employeesService.getMine(subject);
  },

  // ---- photo (W8) -----------------------------------------------------------------------------------------------
  async uploadPhoto(subject: AccessSubject, id: string | 'me', buffer: Buffer): Promise<{ photoUrl: string }> {
    const ctx = await resolveActor(subject);
    const today = toDateColumn(todayOf());
    const row = id === 'me' ? await employeesRepository.findFileByUserId(ctx.companyId, subject.id, today) : await employeesRepository.findFileById(ctx.companyId, id, today);
    if (!row) throw new NotFoundError('Employee not found');
    const own = row.userId !== null && row.userId === subject.id;
    if (!(own && workforceCan(subject, 'me.file'))) {
      if (!inScope(subject, 'employee.read_basic', targetOf(row)) && !inScope(subject, 'employee.write_basic', targetOf(row))) throw new NotFoundError('Employee not found');
      assertCanEditBasics(subject, row);
    }
    const photoUrl = await uploadImageBuffer(buffer, 'employee-photos');
    await runAudited(async (tx) => {
      await employeesRepository.setPhoto(tx, row.id, ctx.companyId, photoUrl);
      await employeesRepository.resolveFileRequests(tx, row.id, ['PHOTO_AND_DETAILS'], new Date());
      return {
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: row.siteId,
            actor: ctx.auditActor,
            action: own ? 'people.self_updated' : 'people.updated',
            category: 'PEOPLE',
            subjectType: 'Employee',
            subjectId: row.id,
            subjectUserId: row.userId,
            after: { changed: ['photoUrl'] },
          },
        ],
      };
    });
    return { photoUrl };
  },

  // ---- file requests (W25) --------------------------------------------------------------------------------------
  async askForDetail(subject: AccessSubject, id: string, kind: FileRequestKind): Promise<FileRequestRow> {
    const ctx = await resolveActor(subject);
    const today = todayOf();
    const row = await loadReadableRow(ctx, id, today);
    assertInScope(subject, 'employee.write_basic', targetOf(row));
    if (row.userId === null) throw new ConflictError('This person has no login to ask', 'NO_LOGIN');
    const created = await employeesRepository.createFileRequest({ employeeId: row.id, kind, askedById: subject.id });
    await told([row.userId], 'file_request.asked', { kind });
    return { id: created.id, kind: created.kind as FileRequestKind, askedOn: nairobiDateOf(created.askedAt), remindedOn: instantDate(created.remindedAt), resolvedOn: instantDate(created.resolvedAt) };
  },

  async remind(subject: AccessSubject, id: string, requestId: string): Promise<FileRequestRow> {
    const ctx = await resolveActor(subject);
    const row = await loadReadableRow(ctx, id, todayOf());
    assertInScope(subject, 'employee.write_basic', targetOf(row));
    const request = await employeesRepository.findFileRequest(row.id, requestId);
    if (!request || request.resolvedAt) throw new NotFoundError('Request not found');
    const updated = await employeesRepository.remindFileRequest(request.id, new Date());
    await told([row.userId], 'file_request.reminded', { kind: updated.kind });
    return { id: updated.id, kind: updated.kind as FileRequestKind, askedOn: nairobiDateOf(updated.askedAt), remindedOn: instantDate(updated.remindedAt), resolvedOn: instantDate(updated.resolvedAt) };
  },

  // ---- verify statutory (W26) -----------------------------------------------------------------------------------
  async verifyStatutory(subject: AccessSubject, id: string): Promise<EmployeeFileView> {
    const ctx = await resolveActor(subject);
    const row = await loadReadableRow(ctx, id, todayOf());
    assertInScope(subject, 'employee.write_sensitive', targetOf(row));
    if (!row.nssfNumber || !row.shaNumber) throw new ConflictError('NSSF and SHA numbers are not both on file', 'STATUTORY_INCOMPLETE');
    await runAudited(async (tx) => {
      await employeesRepository.updateEmployee(tx, row.id, ctx.companyId, { statutoryVerifiedAt: new Date(), statutoryVerifiedById: subject.id });
      return {
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: row.siteId,
            actor: ctx.auditActor,
            action: 'people.statutory_verified',
            category: 'PEOPLE',
            subjectType: 'Employee',
            subjectId: row.id,
            subjectUserId: row.userId,
          },
        ],
      };
    });
    return employeesService.getFile(subject, id);
  },
};

// Re-exported for the other services in this sub-module.
export { buildFileView };
