import { ConflictError, NotFoundError, ValidationError } from '../../../../../utils/errors';
import { runAudited } from '../../../_shared/audit/audit-writer';
import type { AuditEntryInput } from '../../../_shared/audit/audit.types';
import type { WorkforceEvent } from '../../../_shared/events';
import type { AccessSubject } from '../../../_shared/workforce-access';
import { resolveActor, todayOf, type ActorCtx } from '../../people-context';
import { collectImpacts, type ImpactLine } from '../../people-hooks';
import type { PositionDetail, PositionImpact, PositionView } from '../org.types';
import { isUniqueViolation } from '../org-errors';
import { assertCompanyWideWrite, orgReadScope } from '../org-scope';
import type { PositionCreateBody, PositionsQuery, PositionUpdateBody } from '../org-validators';
import { positionsRepository, type HolderScope, type PositionRecord } from './positions-repository';

const TAKEN = 'A position with that name already exists';

const viewOf = (p: PositionRecord): PositionView => ({
  id: p.id,
  name: p.name,
  defaultTracksTime: p.defaultTracksTime,
  loginRole: p.loginRole,
  casualsAllowed: p.casualsAllowed,
  isActive: p.isActive,
  departments: p.departments.map((d) => d.department),
  holderCount: p._count.employees,
});

const entry = (ctx: ActorCtx, id: string, e: Pick<AuditEntryInput, 'action' | 'before' | 'after'>): AuditEntryInput => ({
  companyId: ctx.companyId,
  siteId: null, // a position belongs to the company
  actor: ctx.auditActor,
  category: 'PEOPLE',
  subjectType: 'Position',
  subjectId: id,
  ...e,
});

async function load(ctx: ActorCtx, id: string): Promise<PositionRecord> {
  const position = await positionsRepository.find(ctx.companyId, id);
  if (!position) throw new NotFoundError('Position not found');
  return position;
}

/** Holder names the viewer may see: their whole company, their site, or the departments they head. */
function holderScope(subject: AccessSubject): HolderScope {
  const scope = orgReadScope(subject);
  if (scope.kind === 'all') return { kind: 'all' };
  if (scope.kind === 'site') return { kind: 'site', siteId: scope.siteId };
  return { kind: 'departments', departmentIds: scope.departmentIds };
}

/** O10 to O15: the positions a department offers. */
export const positionsService = {
  async list(subject: AccessSubject, query: PositionsQuery): Promise<PositionView[]> {
    const ctx = await resolveActor(subject);
    orgReadScope(subject); // refuses a viewer with no organisation read at all
    return (await positionsRepository.list(ctx.companyId, query)).map(viewOf);
  },

  async get(subject: AccessSubject, id: string): Promise<PositionDetail> {
    const ctx = await resolveActor(subject);
    const scope = holderScope(subject);
    const position = await load(ctx, id);
    const holders = await positionsRepository.holders(ctx.companyId, id, scope);
    return { ...viewOf(position), holders: holders.map((h) => ({ employeeId: h.id, name: h.name, siteId: h.siteId, departmentId: h.departmentId })) };
  },

  async create(subject: AccessSubject, body: PositionCreateBody): Promise<PositionDetail> {
    const ctx = await resolveActor(subject);
    assertCompanyWideWrite(subject);
    let id: string;
    try {
      id = await runAudited(async (tx) => {
        if (await positionsRepository.nameTaken(tx, ctx.companyId, body.name, null)) throw new ConflictError(TAKEN, 'POSITION_NAME_TAKEN');
        const departments = await positionsRepository.departmentsOfCompany(tx, ctx.companyId, body.departmentIds);
        if (departments.length !== body.departmentIds.length) throw new ValidationError('One of those departments is not available', 'DEPARTMENT_NOT_AVAILABLE');
        const created = await positionsRepository.create(tx, { companyId: ctx.companyId, name: body.name, defaultTracksTime: body.defaultTracksTime, loginRole: body.loginRole, casualsAllowed: body.casualsAllowed });
        await positionsRepository.setDepartments(tx, created.id, body.departmentIds);
        return { result: created.id, entries: [entry(ctx, created.id, { action: 'org.position_created', after: { name: body.name, departments: body.departmentIds.length } })] };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError(TAKEN, 'POSITION_NAME_TAKEN');
      throw error;
    }
    return positionsService.get(subject, id);
  },

  /** O13: who would switch "clocks in" if the default changed, and what later slices say about it. */
  async impact(subject: AccessSubject, id: string, defaultTracksTime: boolean, now: Date = new Date()): Promise<PositionImpact> {
    const ctx = await resolveActor(subject);
    assertCompanyWideWrite(subject);
    await load(ctx, id);
    const people = await positionsRepository.affectedByTracksTime(ctx.companyId, id, defaultTracksTime);
    return { people: people.map((p) => ({ employeeId: p.id, name: p.name })), count: people.length, impacts: await impactLines(people, defaultTracksTime, todayOf(now)) };
  },

  async update(subject: AccessSubject, id: string, body: PositionUpdateBody, now: Date = new Date()): Promise<PositionDetail> {
    const ctx = await resolveActor(subject);
    assertCompanyWideWrite(subject);
    const position = await load(ctx, id);
    if (!position.isActive) throw new ConflictError('This position is retired', 'POSITION_RETIRED');
    const today = todayOf(now);
    try {
      await runAudited(async (tx) => {
        const changed: string[] = [];
        const events: WorkforceEvent[] = [];
        let switched = 0;
        const data: { name?: string; loginRole?: PositionCreateBody['loginRole']; casualsAllowed?: boolean; defaultTracksTime?: boolean } = {};

        if (body.name !== undefined && body.name !== position.name) {
          if (await positionsRepository.nameTaken(tx, ctx.companyId, body.name, id)) throw new ConflictError(TAKEN, 'POSITION_NAME_TAKEN');
          data.name = body.name;
          changed.push('name');
        }
        if (body.loginRole !== undefined && body.loginRole !== position.loginRole) { data.loginRole = body.loginRole; changed.push('loginRole'); }
        if (body.casualsAllowed !== undefined && body.casualsAllowed !== position.casualsAllowed) { data.casualsAllowed = body.casualsAllowed; changed.push('casualsAllowed'); }

        if (body.defaultTracksTime !== undefined && body.defaultTracksTime !== position.defaultTracksTime) {
          const affected = await positionsRepository.affectedByTracksTime(ctx.companyId, id, body.defaultTracksTime, tx);
          if ((body.acknowledgedPeople ?? 0) !== affected.length) {
            throw new ConflictError(`This changes "clocks in" for ${affected.length} people; confirm the number to go on`, 'ACKNOWLEDGE_IMPACT', { count: affected.length });
          }
          data.defaultTracksTime = body.defaultTracksTime;
          changed.push('defaultTracksTime');
          if (affected.length > 0) {
            await positionsRepository.applyTracksTime(tx, ctx.companyId, affected.map((p) => p.id), body.defaultTracksTime);
            switched = affected.length;
            for (const p of affected) {
              events.push({ name: 'employee.tracks_time_changed', occurredAt: now.toISOString(), payload: { employeeId: p.id, userId: p.userId, siteId: p.siteId, tracksTime: body.defaultTracksTime, effectiveOn: today } });
            }
          }
        }
        if (body.departmentIds !== undefined) {
          const wanted = body.departmentIds;
          if ((await positionsRepository.departmentsOfCompany(tx, ctx.companyId, wanted)).length !== wanted.length) throw new ValidationError('One of those departments is not available', 'DEPARTMENT_NOT_AVAILABLE');
          const current = await positionsRepository.linkedDepartmentIds(tx, id);
          const removed = current.filter((d) => !wanted.includes(d));
          if (removed.length > 0 && (await positionsRepository.holdersInDepartments(tx, ctx.companyId, id, removed)) > 0) {
            throw new ConflictError('Someone holds this position in a department you are taking it off', 'POSITION_HELD');
          }
          if (removed.length > 0 || wanted.some((d) => !current.includes(d))) {
            await positionsRepository.setDepartments(tx, id, wanted);
            changed.push('departments');
          }
        }
        if (Object.keys(data).length > 0) await positionsRepository.update(tx, ctx.companyId, id, data);
        return { result: null, entries: changed.length === 0 ? [] : [entry(ctx, id, { action: 'org.position_updated', before: { name: position.name }, after: { changed, peopleChanged: switched } })], events };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError(TAKEN, 'POSITION_NAME_TAKEN');
      throw error;
    }
    return positionsService.get(subject, id);
  },

  async retire(subject: AccessSubject, id: string): Promise<PositionDetail> {
    const ctx = await resolveActor(subject);
    assertCompanyWideWrite(subject);
    const position = await load(ctx, id);
    if (!position.isActive) throw new ConflictError('This position is already retired', 'POSITION_RETIRED');
    await runAudited(async (tx) => {
      if ((await positionsRepository.holderCount(tx, ctx.companyId, id)) > 0) {
        throw new ConflictError('People still hold this position', 'POSITION_HELD', { holders: await positionsRepository.holdersAnywhere(tx, ctx.companyId, id) });
      }
      await positionsRepository.setActive(tx, ctx.companyId, id, false);
      return { result: null, entries: [entry(ctx, id, { action: 'org.position_retired', after: { name: position.name } })] };
    });
    return positionsService.get(subject, id);
  },

  async restore(subject: AccessSubject, id: string): Promise<PositionDetail> {
    const ctx = await resolveActor(subject);
    assertCompanyWideWrite(subject);
    const position = await load(ctx, id);
    if (position.isActive) throw new ConflictError('This position is not retired', 'POSITION_NOT_RETIRED');
    await runAudited(async (tx) => {
      await positionsRepository.setActive(tx, ctx.companyId, id, true);
      return { result: null, entries: [entry(ctx, id, { action: 'org.position_restored', after: { name: position.name } })] };
    });
    return positionsService.get(subject, id);
  },
};

/** One call per site that has affected people, so a later slice can answer for its own site. */
async function impactLines(people: readonly { id: string; siteId: string }[], tracksTime: boolean, today: ReturnType<typeof todayOf>): Promise<ImpactLine[]> {
  if (tracksTime || people.length === 0) return []; // only switching clocking OFF has consequences for the rota and the clock
  const bySite = new Map<string, string[]>();
  for (const p of people) bySite.set(p.siteId, [...(bySite.get(p.siteId) ?? []), p.id]);
  const lines = await Promise.all([...bySite].map(([siteId, employeeIds]) => collectImpacts({ kind: 'TRACKS_TIME_OFF', employeeIds, siteId, departmentId: null, effectiveOn: today })));
  return lines.flat();
}
