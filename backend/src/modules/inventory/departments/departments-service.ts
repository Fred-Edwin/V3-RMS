import type { Request } from 'express';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../../../utils/errors';
import { actorCan } from '../_shared/central-store-access';
import { toPerson } from '../counting/_shared/count-people';
import type { DepartmentErrorCode, DepartmentRow, ListDepartments, ListDepartmentsQuery } from './_shared/departments-contract';
import { departmentsRepository } from './departments-repository';
import type { BranchPickRecord, DepartmentRecord } from './departments.types';

type Actor = NonNullable<Request['user']>;

const STATUS: Record<DepartmentErrorCode, number> = {
  DEPARTMENT_NAME_TAKEN: 409,
  DEPARTMENT_RETIRED: 409,
  DEPARTMENT_ACTIVE: 409,
  WRONG_BRANCH: 403,
};

const departmentError = (code: DepartmentErrorCode, message: string): AppError => new AppError(STATUS[code], code, message);

/** The Branch Manager works on their own branch only; the System Admin on any; the other roles only read. */
const mayWriteTo = (actor: Actor, branchId: string): boolean =>
  actorCan(actor, 'departments.write') && (actor.role === 'SYSTEM_ADMIN' || actor.siteId === branchId);

const requireWriter = (actor: Actor, branchId: string): void => {
  if (!actorCan(actor, 'departments.write')) throw new ForbiddenError('You do not have permission to change departments');
  if (!mayWriteTo(actor, branchId)) throw departmentError('WRONG_BRANCH', 'You can only change departments of your own branch.');
};

const toRow = (
  actor: Actor,
  record: DepartmentRecord,
  head: Parameters<typeof toPerson>[0] | undefined,
  itemsTagged: number,
): DepartmentRow => {
  const writable = mayWriteTo(actor, record.siteId);
  const active = record.status === 'ACTIVE';
  return {
    id: record.id,
    branchId: record.siteId,
    name: record.name,
    key: record.key,
    status: record.status,
    position: record.position,
    head: head ? toPerson(head) : null,
    itemsTagged,
    retiredAt: record.retiredAt ? record.retiredAt.toISOString() : null,
    can: { rename: writable && active, retire: writable && active, restore: writable && !active },
  };
};

const rowsFor = async (actor: Actor, records: DepartmentRecord[], siteId: string): Promise<DepartmentRow[]> => {
  const ids = records.map((r) => r.id);
  const [heads, counts] = await Promise.all([departmentsRepository.listHeads(siteId, ids), departmentsRepository.countItemsByDepartment(ids)]);
  const headOf = new Map(heads.map((h) => [h.departmentId, h]));
  return records.map((r) => toRow(actor, r, headOf.get(r.id), counts.get(r.id) ?? 0));
};

const oneRow = async (actor: Actor, record: DepartmentRecord): Promise<DepartmentRow> => (await rowsFor(actor, [record], record.siteId))[0] as DepartmentRow;

/** Finds the department and proves the caller may change its branch. The id alone says which branch, so the check comes straight after. */
const loadForWrite = async (actor: Actor, id: string): Promise<DepartmentRecord> => {
  const record = await departmentsRepository.findById(id);
  if (!record) throw new NotFoundError('Department not found');
  requireWriter(actor, record.siteId);
  return record;
};

export const departmentsService = {
  /** R23. A Branch Manager always gets their own branch; a hub role picks one (the first when omitted) and gets the picker. */
  list: async (actor: Actor, query: ListDepartmentsQuery): Promise<ListDepartments> => {
    const isBranchManager = actor.role === 'MANAGER';
    let branches: BranchPickRecord[] = [];
    let branch: BranchPickRecord | null;
    if (isBranchManager) {
      if (!actor.siteId) throw new ValidationError('Branch context missing for this user');
      branch = await departmentsRepository.findBranch(actor.siteId);
    } else {
      branches = await departmentsRepository.listBranches();
      const wanted = query.branchId ?? branches[0]?.id;
      branch = wanted ? await departmentsRepository.findBranch(wanted) : null;
    }
    if (!branch) throw new NotFoundError('Branch not found');
    const records = await departmentsRepository.listByBranch(branch.id);
    return {
      branch,
      ...(isBranchManager ? {} : { branches }),
      rows: await rowsFor(actor, records, branch.id),
      canAdd: mayWriteTo(actor, branch.id),
    };
  },

  /** R24. */
  add: async (actor: Actor, input: { branchId: string; name: string }): Promise<DepartmentRow> => {
    requireWriter(actor, input.branchId);
    const branch = await departmentsRepository.findBranch(input.branchId);
    if (!branch) throw new NotFoundError('Branch not found');
    if (await departmentsRepository.findByName(branch.id, input.name)) {
      throw departmentError('DEPARTMENT_NAME_TAKEN', 'This branch already has a department with that name.');
    }
    return oneRow(actor, await departmentsRepository.create(branch.id, input.name));
  },

  /** R25. A rename never touches the legacy key. */
  rename: async (actor: Actor, id: string, input: { name: string }): Promise<DepartmentRow> => {
    const record = await loadForWrite(actor, id);
    if (record.status === 'RETIRED') throw departmentError('DEPARTMENT_RETIRED', 'Restore this department before renaming it.');
    if (await departmentsRepository.findByName(record.siteId, input.name, record.id)) {
      throw departmentError('DEPARTMENT_NAME_TAKEN', 'This branch already has a department with that name.');
    }
    return oneRow(actor, await departmentsRepository.rename(record.id, record.siteId, input.name));
  },

  /** R26. Past requisitions keep their sections; new ones get no section for a retired department. */
  retire: async (actor: Actor, id: string): Promise<DepartmentRow> => {
    const record = await loadForWrite(actor, id);
    if (record.status === 'RETIRED') throw departmentError('DEPARTMENT_RETIRED', 'This department is already retired.');
    return oneRow(actor, await departmentsRepository.setStatus(record.id, record.siteId, 'RETIRED'));
  },

  restore: async (actor: Actor, id: string): Promise<DepartmentRow> => {
    const record = await loadForWrite(actor, id);
    if (record.status === 'ACTIVE') throw departmentError('DEPARTMENT_ACTIVE', 'This department is already active.');
    return oneRow(actor, await departmentsRepository.setStatus(record.id, record.siteId, 'ACTIVE'));
  },
};
