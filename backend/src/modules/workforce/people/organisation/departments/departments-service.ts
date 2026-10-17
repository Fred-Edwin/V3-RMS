import { ConflictError, NotFoundError, ValidationError } from '../../../../../utils/errors';
import { runAudited } from '../../../_shared/audit/audit-writer';
import type { AuditEntryInput } from '../../../_shared/audit/audit.types';
import type { AccessSubject } from '../../../_shared/workforce-access';
import { resolveActor, type ActorCtx } from '../../people-context';
import type { DepartmentView } from '../org.types';
import { isUniqueViolation } from '../org-errors';
import { assertCanWriteIn } from '../org-scope';
import type { DepartmentCreateBody, DepartmentUpdateBody } from '../org-validators';
import { buildDepartmentView } from './departments-read-service';
import { departmentsRepository, type DepartmentRecord } from './departments-repository';

const FIRST_PAGE = { page: 1, perPage: 50 } as const;
const TAKEN = 'A department with that name already exists at this site';

/** O3 to O5: create, edit, retire and restore a department. Heads are in heads-service.ts. */
const entry = (ctx: ActorCtx, department: Pick<DepartmentRecord, 'id' | 'siteId'>, e: Pick<AuditEntryInput, 'action' | 'before' | 'after' | 'reason'>): AuditEntryInput => ({
  companyId: ctx.companyId,
  siteId: department.siteId,
  actor: ctx.auditActor,
  category: 'PEOPLE',
  subjectType: 'Department',
  subjectId: department.id,
  ...e,
});

async function load(ctx: ActorCtx, id: string, subject: AccessSubject): Promise<DepartmentRecord> {
  const department = await departmentsRepository.findDepartment(ctx.companyId, id);
  if (!department) throw new NotFoundError('Department not found');
  assertCanWriteIn(subject, 'org.write', { siteId: department.siteId, id: department.id });
  return department;
}

async function checkPositions(ctx: ActorCtx, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const found = await departmentsRepository.activePositionIds(ctx.companyId, ids);
  if (found.length !== ids.length) throw new ValidationError('One of those positions is not available', 'POSITION_NOT_AVAILABLE');
}

/** The department as the caller sees it after a write. */
export async function viewAfterWrite(subject: AccessSubject, ctx: ActorCtx, id: string, now: Date): Promise<DepartmentView> {
  const department = await departmentsRepository.findDepartment(ctx.companyId, id);
  if (!department) throw new NotFoundError('Department not found');
  return buildDepartmentView(subject, ctx.companyId, department, FIRST_PAGE, now);
}

export const departmentsService = {
  async create(subject: AccessSubject, body: DepartmentCreateBody, now: Date = new Date()): Promise<DepartmentView> {
    const ctx = await resolveActor(subject);
    assertCanWriteIn(subject, 'org.write', { siteId: body.siteId });
    const site = await departmentsRepository.findSite(ctx.companyId, body.siteId);
    if (!site) throw new ValidationError('That site is not available', 'SITE_NOT_AVAILABLE');
    await checkPositions(ctx, body.positionIds);
    let id: string;
    try {
      id = await runAudited(async (tx) => {
        if (await departmentsRepository.nameTaken(tx, site.id, body.name, null)) throw new ConflictError(TAKEN, 'DEPARTMENT_NAME_TAKEN');
        const created = await departmentsRepository.create(tx, { siteId: site.id, name: body.name, description: body.description ?? null, position: (await departmentsRepository.nextOrder(tx, site.id)) + 1 });
        await departmentsRepository.setOfferedPositions(tx, created.id, body.positionIds);
        return {
          result: created.id,
          entries: [entry(ctx, { id: created.id, siteId: site.id }, { action: 'org.department_created', after: { name: body.name, positions: body.positionIds.length } })],
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError(TAKEN, 'DEPARTMENT_NAME_TAKEN');
      throw error;
    }
    return viewAfterWrite(subject, ctx, id, now);
  },

  async update(subject: AccessSubject, id: string, body: DepartmentUpdateBody, now: Date = new Date()): Promise<DepartmentView> {
    const ctx = await resolveActor(subject);
    const department = await load(ctx, id, subject);
    if (department.status === 'RETIRED') throw new ConflictError('This department is retired', 'DEPARTMENT_RETIRED');
    if (body.positionIds) await checkPositions(ctx, body.positionIds);
    try {
      await runAudited(async (tx) => {
        const changed: string[] = [];
        if (body.name !== undefined && body.name !== department.name) {
          if (await departmentsRepository.nameTaken(tx, department.siteId, body.name, department.id)) throw new ConflictError(TAKEN, 'DEPARTMENT_NAME_TAKEN');
          changed.push('name');
        }
        if (body.description !== undefined && body.description !== department.description) changed.push('description');
        if (changed.length > 0) {
          await departmentsRepository.update(tx, department.siteId, department.id, {
            ...(changed.includes('name') ? { name: body.name } : {}),
            ...(changed.includes('description') ? { description: body.description ?? null } : {}),
          });
        }
        if (body.positionIds) {
          const current = await departmentsRepository.offeredPositionIds(tx, department.id);
          const removed = current.filter((positionId) => !body.positionIds!.includes(positionId));
          if (removed.length > 0 && (await departmentsRepository.holdersOfPositions(tx, ctx.companyId, department.id, removed)) > 0) {
            throw new ConflictError('Someone in this department holds a position you are taking off its list', 'POSITION_HELD');
          }
          if (removed.length > 0 || body.positionIds.some((positionId) => !current.includes(positionId))) {
            await departmentsRepository.setOfferedPositions(tx, department.id, body.positionIds);
            changed.push('positions');
          }
        }
        return {
          result: null,
          entries: changed.length === 0 ? [] : [entry(ctx, department, { action: 'org.department_updated', before: { name: department.name }, after: { changed } })],
        };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError(TAKEN, 'DEPARTMENT_NAME_TAKEN');
      throw error;
    }
    return viewAfterWrite(subject, ctx, id, now);
  },

  async retire(subject: AccessSubject, id: string, now: Date = new Date()): Promise<DepartmentView> {
    const ctx = await resolveActor(subject);
    const department = await load(ctx, id, subject);
    if (department.status === 'RETIRED') throw new ConflictError('This department is already retired', 'DEPARTMENT_RETIRED');
    await runAudited(async (tx) => {
      const people = await departmentsRepository.peopleCount(ctx.companyId, department.id, tx);
      if (people > 0) throw new ConflictError(`${people} people still work in this department`, 'DEPARTMENT_HAS_PEOPLE', { people });
      await departmentsRepository.setStatus(tx, department.siteId, department.id, 'RETIRED');
      return { result: null, entries: [entry(ctx, department, { action: 'org.department_retired', after: { name: department.name } })] };
    });
    return viewAfterWrite(subject, ctx, id, now);
  },

  async restore(subject: AccessSubject, id: string, now: Date = new Date()): Promise<DepartmentView> {
    const ctx = await resolveActor(subject);
    const department = await load(ctx, id, subject);
    if (department.status === 'ACTIVE') throw new ConflictError('This department is not retired', 'DEPARTMENT_NOT_RETIRED');
    await runAudited(async (tx) => {
      await departmentsRepository.setStatus(tx, department.siteId, department.id, 'ACTIVE');
      return { result: null, entries: [entry(ctx, department, { action: 'org.department_restored', after: { name: department.name } })] };
    });
    return viewAfterWrite(subject, ctx, id, now);
  },

};
