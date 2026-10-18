import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import type { AuditEntryInput } from '../../_shared/audit/audit.types';
import { addDays, nairobiToday, parseNairobiDate, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { scopeOf, type AccessSubject } from '../../_shared/workforce-access';
import { getEffectiveRuleGroup } from '../../rules/rules-service';
import { resolveActor, type ActorCtx } from '../../people/people-context';
import { weekStartOf } from '../rota-days';
import { assertTemplateWrite } from '../rota-scope';
import type { TemplateView } from '../rota.types';
import { assertShiftWindow, toTemplateView } from './template-rules';
import { templatesRepository, type Db, type TemplateRecord, type TemplateScope } from './templates-repository';
import type { TemplateCreateBody, TemplatesQuery } from './templates-validators';

/** R1 to R4 (templates): list, add, retire and restore. Changing a shift is in templates-update-service.ts. */
export const templateEntry = (ctx: ActorCtx, template: Pick<TemplateRecord, 'id' | 'siteId'>, e: Pick<AuditEntryInput, 'action' | 'before' | 'after' | 'reason'>): AuditEntryInput => ({
  companyId: ctx.companyId,
  siteId: template.siteId,
  actor: ctx.auditActor,
  category: 'TIME',
  subjectType: 'ShiftTemplate',
  subjectId: template.id,
  ...e,
});

export async function loadWritable(ctx: ActorCtx, subject: AccessSubject, id: string): Promise<TemplateRecord> {
  const template = await templatesRepository.findById(ctx.companyId, id);
  if (!template) throw new NotFoundError('Shift not found');
  assertTemplateWrite(subject, template.siteId);
  return template;
}

/** Departments named for a shift must be the company's, and a site shift's must be that site's. */
export async function checkDepartments(ctx: ActorCtx, siteId: string | null, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const found = await templatesRepository.departmentsInCompany(ctx.companyId, ids);
  if (found.length !== ids.length || (siteId !== null && found.some((d) => d.siteId !== siteId))) {
    throw new ValidationError('One of those departments is not available for this shift', 'DEPARTMENT_NOT_AVAILABLE');
  }
}

export async function assertFreeNameAndLetter(
  db: Db,
  ctx: ActorCtx,
  where: { siteId: string | null; name: string; letter: string | null; exceptId: string | null },
): Promise<void> {
  if (await templatesRepository.nameTaken(db, ctx.companyId, where.siteId, where.name, where.exceptId)) throw new ConflictError('A shift with that name already exists here', 'TEMPLATE_NAME_TAKEN');
  if (where.letter && (await templatesRepository.letterTaken(db, ctx.companyId, where.siteId, where.letter, where.exceptId))) {
    throw new ConflictError('Another shift already uses that letter', 'TEMPLATE_LETTER_TAKEN');
  }
}

function listScope(subject: AccessSubject, requestedSiteId: string | undefined): TemplateScope {
  const scope = scopeOf(subject, 'rota.read');
  if (scope === null) throw new ForbiddenError('You do not have permission to perform this action');
  if (scope === 'all') return requestedSiteId ? { kind: 'site', siteId: requestedSiteId } : { kind: 'all' };
  if (!subject.siteId) throw new ForbiddenError('You do not have permission to perform this action');
  if (requestedSiteId && requestedSiteId !== subject.siteId) throw new NotFoundError('Not found');
  return { kind: 'site', siteId: subject.siteId };
}

export async function viewOf(ctx: ActorCtx, id: string): Promise<TemplateView> {
  const row = await templatesRepository.findById(ctx.companyId, id);
  if (!row) throw new NotFoundError('Shift not found');
  return toTemplateView(row, 0);
}

export const templatesService = {
  async list(subject: AccessSubject, query: TemplatesQuery, now: Date = new Date()): Promise<{ templates: TemplateView[]; weekStart: NairobiDate | null }> {
    const ctx = await resolveActor(subject);
    const scope = listScope(subject, query.siteId);
    const rows = await templatesRepository.list(ctx.companyId, scope, query.includeRetired);
    let counts = new Map<string, number>();
    let weekStart: NairobiDate | null = null;
    if (scope.kind === 'site') {
      const today = nairobiToday(now);
      const rule = await getEffectiveRuleGroup(scope.siteId, today, 'WEEK_AND_BREAKS');
      const start = query.weekStart ? parseNairobiDate(query.weekStart) : weekStartOf(today, rule.values.weekStartsOn);
      weekStart = start;
      counts = await templatesRepository.countByTemplate(scope.siteId, toDateColumn(start), toDateColumn(addDays(start, 6)));
    }
    return { templates: rows.map((row) => toTemplateView(row, counts.get(row.id) ?? 0)), weekStart };
  },

  async create(subject: AccessSubject, body: TemplateCreateBody): Promise<TemplateView> {
    const ctx = await resolveActor(subject);
    assertTemplateWrite(subject, body.siteId);
    assertShiftWindow(body.startTime, body.endTime, body.unpaidBreakMinutes);
    if (body.siteId && !(await templatesRepository.siteInCompany(ctx.companyId, body.siteId))) throw new ValidationError('That site is not available', 'SITE_NOT_AVAILABLE');
    await checkDepartments(ctx, body.siteId, body.departmentIds);
    const id = await runAudited(async (tx) => {
      await assertFreeNameAndLetter(tx, ctx, { siteId: body.siteId, name: body.name, letter: body.letter ?? null, exceptId: null });
      const created = await templatesRepository.create(tx, {
        companyId: ctx.companyId,
        siteId: body.siteId,
        name: body.name,
        letter: body.letter ?? null,
        colour: body.colour,
        startTime: body.startTime,
        endTime: body.endTime,
        unpaidBreakMinutes: body.unpaidBreakMinutes,
        createdById: subject.id,
      });
      await templatesRepository.replaceDepartments(tx, created.id, body.departmentIds);
      const after = { name: body.name, start: body.startTime, end: body.endTime, breakMinutes: body.unpaidBreakMinutes, companyWide: body.siteId === null };
      return { result: created.id, entries: [templateEntry(ctx, { id: created.id, siteId: body.siteId }, { action: 'rota.template_created', after })] };
    });
    return viewOf(ctx, id);
  },

  async retire(subject: AccessSubject, id: string, now: Date = new Date()): Promise<TemplateView> {
    const ctx = await resolveActor(subject);
    const template = await loadWritable(ctx, subject, id);
    if (!template.isActive) throw new ConflictError('This shift is already retired', 'TEMPLATE_RETIRED');
    const from = toDateColumn(nairobiToday(now));
    await runAudited(async (tx) => {
      const inUse = (await templatesRepository.entriesFrom(tx, id, from)).length;
      if (inUse > 0) throw new ConflictError(`${inUse} upcoming shifts still use this shift`, 'TEMPLATE_IN_USE', { upcoming: inUse });
      await templatesRepository.update(tx, id, { isActive: false, retiredAt: now });
      return { result: null, entries: [templateEntry(ctx, template, { action: 'rota.template_retired', after: { name: template.name } })] };
    });
    return viewOf(ctx, id);
  },

  async restore(subject: AccessSubject, id: string): Promise<TemplateView> {
    const ctx = await resolveActor(subject);
    const template = await loadWritable(ctx, subject, id);
    if (template.isActive) throw new ConflictError('This shift is not retired', 'TEMPLATE_NOT_RETIRED');
    if (template.supersededById) throw new ConflictError('This shift was replaced by a newer version', 'TEMPLATE_SUPERSEDED');
    await runAudited(async (tx) => {
      await assertFreeNameAndLetter(tx, ctx, { siteId: template.siteId, name: template.name, letter: template.letter, exceptId: template.id });
      await templatesRepository.update(tx, id, { isActive: true, retiredAt: null });
      return { result: null, entries: [templateEntry(ctx, template, { action: 'rota.template_restored', after: { name: template.name } })] };
    });
    return viewOf(ctx, id);
  },
};
