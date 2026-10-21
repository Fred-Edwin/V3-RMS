import type { z } from 'zod';
import { uploadImageBuffer } from '../../../../utils/cloudinary';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { JsonValue } from '../../_shared/audit/audit.types';
import { nairobiDateOf, parseNairobiDate, toDateColumn } from '../../_shared/time/nairobi-time';
import { inScope, scopeOf, workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { assertCanEditBasics, mayHireInto, readScopeOf, targetOf } from '../people-access';
import { resolveActor, told, todayOf } from '../people-context';
import { maskTail } from '../people-masking';
import { payRepository } from '../pay/pay-repository';
import { EXIT_REASONS, EXIT_UNDO_DAYS, HIRE_LOGIN_ROLES, PAY_CHANGE_REASONS, PROBATION_VERDICTS, type FileRequestKind } from '../people.constants';
import type { EmployeeFileView, EmployeeListRow, FileRequestRow, ListResponse, Lookups, Pagination, PeopleSummary, UnlinkedAccount } from '../people.types';
import type { ListQuerySchema } from '../people-validators';
import { buildFileView, instantDate, listRowOf, loadReadableRow, needsFinishing } from './employee-file-view';
import { employeesRepository } from './employees-repository';

export type ListQuery = z.infer<typeof ListQuerySchema>;

const pagination = (total: number, page: number, perPage: number): Pagination => ({ total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) });

const SELF_KINDS: Record<string, FileRequestKind> = {
  emergencyName: 'EMERGENCY_CONTACT',
  emergencyRelation: 'EMERGENCY_CONTACT',
  emergencyPhone: 'EMERGENCY_CONTACT',
  nssfNumber: 'NSSF_SHA',
  shaNumber: 'NSSF_SHA',
  personalPhone: 'PHOTO_AND_DETAILS',
  physicalAddress: 'PHOTO_AND_DETAILS',
  nationalId: 'ID_NUMBER',
  bankName: 'BANK_DETAILS',
  accountNumber: 'BANK_DETAILS',
};
const STATUTORY_FIELDS = ['nssfNumber', 'shaNumber', 'helbNumber', 'kraPin'] as const;
/** What HR verifies on My file: a change here resets the check, and is closed to the person once HR has verified. */
const SELF_CHECKED_FIELDS = [...STATUTORY_FIELDS, 'nationalId', 'bankName', 'accountNumber'] as const;

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

const touchesStatutory = (fields: readonly string[]): boolean => fields.some((k) => (STATUTORY_FIELDS as readonly string[]).includes(k));

const requestOf = (r: { id: string; kind: string; askedAt: Date; remindedAt: Date | null; resolvedAt: Date | null }): FileRequestRow => ({
  id: r.id,
  kind: r.kind as FileRequestKind,
  askedOn: nairobiDateOf(r.askedAt),
  remindedOn: instantDate(r.remindedAt),
  resolvedOn: instantDate(r.resolvedAt),
});

/** Reads and light edits of an employee file. Sensitive opens live in employee-sensitive-service.ts. */
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
      const matches = all.filter((r) => needsFinishing(r.gaps));
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
    const needsFinishingCount = list.map((row) => listRowOf(subject, row)).filter((r) => needsFinishing(r.gaps)).length;
    return { ...counts, needsFinishing: needsFinishingCount };
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
    // Offer only what this role may create (finding 56): positions it may hire into, and departments that still offer one.
    const hirable = positions.filter((p) => mayHireInto(subject, p));
    const offeredDepartmentIds = new Set(hirable.flatMap((p) => p.departments.map((d) => d.departmentId)));
    const shownDepartments = subject.role === 'STORE_MANAGER' ? departments.filter((d) => offeredDepartmentIds.has(d.id)) : departments;
    const ruleSite = sites[0]?.id ?? subject.siteId;
    const rule = ruleSite ? (await getEffectiveRuleGroup(ruleSite, todayOf(), 'PROBATION')).values : { defaultMonths: 0, maxExtensions: 0, maxExtensionMonths: 0 };
    return {
      sites: sites.map((s) => ({ id: s.id, name: s.name, type: s.type, isHub: s.isHub })),
      departments: shownDepartments.map((d) => ({ id: d.id, siteId: d.siteId, name: d.name, inventoryTag: d.key, isActive: d.status === 'ACTIVE' })),
      positions: hirable.map((p) => ({
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
    return buildFileView(subject, await loadReadableRow(ctx, id, today), today);
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
    if (sensitiveKeys.length > 0 && !inScope(subject, 'employee.write_sensitive', target)) {
      throw new ForbiddenError('Only HR can change ID, statutory and address details', 'FIELD_NOT_ALLOWED');
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

    await runAudited(async (tx) => {
      await employeesRepository.updateEmployee(tx, row.id, ctx.companyId, {
        ...data,
        ...(touchesStatutory(fields) ? { statutoryVerifiedAt: null, statutoryVerifiedById: null } : {}),
      });
      return {
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: row.siteId,
            actor: ctx.auditActor,
            action: 'people.updated',
            category: 'PEOPLE' as const,
            subjectType: 'Employee',
            subjectId: row.id,
            subjectUserId: row.userId,
            before,
            after: { ...after, changed: Object.keys(input) },
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
    const touchesChecked = fields.some((k) => (SELF_CHECKED_FIELDS as readonly string[]).includes(k));
    // Until HR has verified, the person may correct a typo; after that a change goes through HR (finding 65).
    if (touchesChecked && row.statutoryVerifiedAt) {
      throw new ConflictError('HR has already checked these details. Ask HR to change them.', 'STATUTORY_VERIFIED');
    }
    if (typeof input.nationalId === 'string' && input.nationalId !== row.nationalId && (await employeesRepository.nationalIdTaken(ctx.companyId, input.nationalId, row.id))) {
      throw new ConflictError('Someone on file already has this ID number', 'DUPLICATE_NATIONAL_ID');
    }
    const { bankName, accountNumber, ...employeeInput } = input;
    // The old value goes in the entry masked (last four at most), never the number itself.
    const previous: Record<string, JsonValue> = {};
    for (const key of SELF_CHECKED_FIELDS) {
      if (input[key] === undefined) continue;
      const oldValue = key === 'bankName' ? row.payProfile?.bankName : key === 'accountNumber' ? row.payProfile?.accountNumber : (row as unknown as Record<string, string | null>)[key];
      previous[key] = key === 'bankName' ? (oldValue ?? null) : (maskTail(oldValue) ?? null);
    }
    await runAudited(async (tx) => {
      await employeesRepository.updateEmployee(tx, row.id, ctx.companyId, {
        ...toDbFields(employeeInput),
        ...(touchesChecked ? { statutoryVerifiedAt: null, statutoryVerifiedById: null } : {}),
      });
      if (bankName !== undefined || accountNumber !== undefined) {
        await payRepository.updateProfile(tx, row.id, {
          ...(bankName !== undefined ? { bankName: typeof bankName === 'string' ? bankName : null } : {}),
          ...(accountNumber !== undefined ? { accountNumber: typeof accountNumber === 'string' ? accountNumber : null } : {}),
          updatedById: subject.id,
        });
      }
      if (kinds.length > 0) await employeesRepository.resolveFileRequests(tx, row.id, kinds, new Date());
      return {
        result: null,
        entries: [
          {
            companyId: ctx.companyId,
            siteId: row.siteId,
            actor: ctx.auditActor,
            action: 'people.self_updated',
            category: 'PEOPLE' as const,
            subjectType: 'Employee',
            subjectId: row.id,
            subjectUserId: row.userId,
            ...(Object.keys(previous).length > 0 ? { before: previous } : {}),
            after: { changed: Object.keys(input) },
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
      const target = targetOf(row);
      if (!inScope(subject, 'employee.read_basic', target) && !inScope(subject, 'employee.write_basic', target)) throw new NotFoundError('Employee not found');
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
            category: 'PEOPLE' as const,
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
    const row = await loadReadableRow(ctx, id, todayOf());
    if (!inScope(subject, 'employee.write_basic', targetOf(row))) throw new ForbiddenError('You do not have permission to perform this action');
    if (row.userId === null) throw new ConflictError('This person has no login to ask', 'NO_LOGIN');
    const created = await employeesRepository.createFileRequest({ employeeId: row.id, kind, askedById: subject.id });
    await told([row.userId], 'file_request.asked', { kind });
    return requestOf(created);
  },

  async remind(subject: AccessSubject, id: string, requestId: string): Promise<FileRequestRow> {
    const ctx = await resolveActor(subject);
    const row = await loadReadableRow(ctx, id, todayOf());
    if (!inScope(subject, 'employee.write_basic', targetOf(row))) throw new ForbiddenError('You do not have permission to perform this action');
    const request = await employeesRepository.findFileRequest(row.id, requestId);
    if (!request || request.resolvedAt) throw new NotFoundError('Request not found');
    const updated = await employeesRepository.remindFileRequest(request.id, new Date());
    await told([row.userId], 'file_request.reminded', { kind: updated.kind });
    return requestOf(updated);
  },

  // ---- verify statutory (W26) -----------------------------------------------------------------------------------
  async verifyStatutory(subject: AccessSubject, id: string): Promise<EmployeeFileView> {
    const ctx = await resolveActor(subject);
    const row = await loadReadableRow(ctx, id, todayOf());
    if (!inScope(subject, 'employee.write_sensitive', targetOf(row))) throw new ForbiddenError('You do not have permission to perform this action');
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
            category: 'PEOPLE' as const,
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
