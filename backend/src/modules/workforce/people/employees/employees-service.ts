import type { z } from 'zod';
import { uploadImageBuffer } from '../../../../utils/cloudinary';
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../../utils/errors';
import { logger } from '../../../../utils/logger';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { JsonValue } from '../../_shared/audit/audit.types';
import { parseNairobiDate, toDateColumn } from '../../_shared/time/nairobi-time';
import { inScope, workforceCan, type AccessSubject } from '../../_shared/workforce-access';
import { assertCanEditBasics, readScopeOf, targetOf } from '../people-access';
import { resolveActor, told, todayOf } from '../people-context';
import { maskTail } from '../rules/people-masking';
import { payRepository } from '../pay/pay-repository';
import type { FileRequestKind } from '../people.constants';
import type { EmployeeFileView, EmployeeListRow, ListResponse } from '../people.types';
import type { ListQuerySchema } from '../people-validators';
import { blocksPayroll, buildFileView, listRowOf, loadReadableRow, needsFinishing } from './employee-file-view';
import { employeeLookupsService, pagination } from './employee-lookups-service';
import { employeeRequestsService } from './employee-requests-service';
import { employeesRepository } from './employees-repository';

export type ListQuery = z.infer<typeof ListQuerySchema>;

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
/** The numbers the person edits on My file at any time; the old value goes in the audit entry masked. */
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

/** Reads and light edits of an employee file. Sensitive opens live in employee-sensitive-service.ts; the lists' counts and pick-lists
 *  in employee-lookups-service.ts; file requests and the statutory check in employee-requests-service.ts. */
export const employeesService = {
  ...employeeLookupsService,
  ...employeeRequestsService,

  async list(subject: AccessSubject, query: ListQuery): Promise<ListResponse<EmployeeListRow>> {
    // The pay-change lists show who has a pay change coming: pay people only (the Branch and Store Managers see no pay).
    if ((query.filter === 'pay_change' || query.filter === 'pay_change_month') && !workforceCan(subject, 'payprofile.read')) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
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
    if (query.filter === 'needs_finishing' || query.filter === 'blocks_payroll') {
      const all = (await employeesRepository.listAll(base)).map((row) => listRowOf(subject, row));
      const matches = all.filter((r) => (query.filter === 'blocks_payroll' ? blocksPayroll(r.gaps) : needsFinishing(r.gaps)));
      const start = (query.page - 1) * query.perPage;
      return { success: true, data: matches.slice(start, start + query.perPage).map((r) => r.view), pagination: pagination(matches.length, query.page, query.perPage) };
    }
    const { rows, total } = await employeesRepository.list(base, query.page, query.perPage);
    return { success: true, data: rows.map((row) => listRowOf(subject, row).view), pagination: pagination(total, query.page, query.perPage) };
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
    // Owner decision, 22 Oct 2026: the person edits their own numbers and bank at any time; it saves at once and HR does not re-check.
    const bankChanged =
      (input.bankName !== undefined && input.bankName !== (row.payProfile?.bankName ?? null)) ||
      (input.accountNumber !== undefined && input.accountNumber !== (row.payProfile?.accountNumber ?? null));
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
    // The Accountant is told that a bank or account changed; the notification never carries the number (wording-built).
    if (bankChanged) await told(await payRepository.accountantUserIds(ctx.companyId), 'pay.bank_changed', { employeeId: row.id, name: row.name });
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
    // A storage fault (no key, bad key, service down) is a 502 with a plain message; the error handler adds the reference (finding 64).
    const photoUrl = await uploadImageBuffer(buffer, 'employee-photos').catch((error: unknown) => {
      logger.error({ err: error instanceof Error ? error.message : 'unknown' }, 'photo storage failed');
      throw new AppError(502, 'PHOTO_STORAGE_FAILED', 'We could not save your photo. Try again, or tell HR and give them the reference below.');
    });
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
};
