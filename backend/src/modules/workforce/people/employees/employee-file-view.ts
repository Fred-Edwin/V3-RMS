import { NotFoundError } from '../../../../utils/errors';
import { daysBetween, fromDateColumn, nairobiDateOf, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import {
  inScope,
  lockedGroupsFor,
  redactSensitive,
  workforceCan,
  type AccessSubject,
  type AccessTarget,
} from '../../_shared/workforce-access';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { assertCanEditBasics, targetOf } from '../people-access';
import { type ActorCtx } from '../people-context';
import {
  checklistPercent,
  checklistRows,
  fileParts,
  gapsOf,
  NEEDS_FINISHING_PARTS,
  ringPercent,
  type FileFacts,
  type FilePart,
} from '../people-completeness';
import { canUndoExit, undoUntil } from '../people-dates';
import { presentField } from '../people-masking';
import { REVEALABLE_FIELDS, type ExitReason, type FileRequestKind, type ProbationVerdict } from '../people.constants';
import type {
  ContractStatusCode,
  EmployeeActions,
  EmployeeFileView,
  EmployeeListRow,
  EmploymentStatusCode,
  ExitView,
  NextStep,
  ProbationView,
  TimelineEvent,
} from '../people.types';
import { employeesRepository, type FileRow, type ListRow } from './employees-repository';

/**
 * Turns database rows into what a screen shows: the list row and the whole file, with sensitive fields hidden or masked
 * for the viewer and the "what can I do" flags worked out from the access table. Pure of writes.
 */
export const dateOrNull = (value: Date | null): NairobiDate | null => (value ? fromDateColumn(value) : null);
export const instantDate = (value: Date | null): NairobiDate | null => (value ? nairobiDateOf(value) : null);

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

export function listRowOf(subject: AccessSubject, row: ListRow): { view: EmployeeListRow; gaps: FilePart[] } {
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

/** True when a list row has a gap that makes the file "Needs finishing" (question 10). */
export const needsFinishing = (gaps: readonly FilePart[]): boolean => gaps.some((g) => (NEEDS_FINISHING_PARTS as readonly string[]).includes(g));

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

/** Which sensitive group a revealable field belongs to. */
export const groupOfField = (field: string): 'ids' | 'bank' => ((IDS_KEYS as readonly string[]).includes(field) ? 'ids' : 'bank');

export async function buildFileView(subject: AccessSubject, row: FileRow, today: NairobiDate): Promise<EmployeeFileView> {
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
  for (const request of row.fileRequests) {
    nextSteps.push({ code: 'FILE_REQUEST', dueOn: null, fileRequestId: request.id, fileRequestKind: request.kind as FileRequestKind, fileRequestAskedOn: nairobiDateOf(request.askedAt) });
  }
  if (canSeeCompleteness && needsFinishing(gapsOf(states, locked)) && status !== 'EXITED') {
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
