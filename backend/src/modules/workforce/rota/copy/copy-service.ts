import { ValidationError } from '../../../../utils/errors';
import { addDays, fromDateColumn, nairobiToday, toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { inScope, type AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { cellsRepository } from '../cells/cells-repository';
import { applyCellChanges, type ApplyResult } from '../cells/cells-apply';
import type { CopyBody } from './copy-validators';
import { assertWeekStart } from '../rota-days';
import { gridScope } from '../rota-scope';
import { templateFits } from '../templates/template-rules';
import { templatesRepository } from '../templates/templates-repository';
import { approvedLeave } from '../warnings/leave-lookup';
import { weeksRepository } from '../weeks/weeks-repository';
import { planCopy, type CopyPlan } from './copy-plan';

export interface CopyPreview extends Omit<CopyPlan, 'changes'> {
  weekStart: NairobiDate;
  copiedFrom: NairobiDate;
  /** True when the target week includes today or tomorrow, so the copy itself needs a reason. */
  reasonRequired: boolean;
}

async function build(subject: AccessSubject, body: CopyBody, now: Date): Promise<{ plan: CopyPlan; siteId: string; copiedFrom: NairobiDate; weekStart: NairobiDate; today: NairobiDate }> {
  const ctx = await resolveActor(subject);
  const { siteId } = gridScope(subject, 'rota.write', body.siteId);
  const weekStart = body.weekStart as NairobiDate;
  await assertWeekStart(siteId, weekStart);
  const today = nairobiToday(now);
  const copiedFrom = addDays(weekStart, -7);
  const [srcFrom, srcTo, dstFrom, dstTo] = [toDateColumn(copiedFrom), toDateColumn(addDays(copiedFrom, 6)), toDateColumn(weekStart), toDateColumn(addDays(weekStart, 6))];

  const sourceRows = await weeksRepository.entriesInRange(siteId, srcFrom, srcTo);
  const people = await cellsRepository.people(ctx.companyId, [...new Set(sourceRows.map((r) => r.employeeId))]);
  const writable = people.filter((p) => p.siteId === siteId && (!body.departmentId || p.departmentId === body.departmentId) && inScope(subject, 'rota.write', p));
  const ids = writable.map((p) => p.id);
  const byId = new Map(writable.map((p) => [p.id, p] as const));

  const [templates, employment, loans, leave, targetRows] = await Promise.all([
    templatesRepository.findManyByIds(ctx.companyId, [...new Set(sourceRows.map((r) => r.templateId))]),
    cellsRepository.employment(ids),
    cellsRepository.loansOut(siteId, ids, dstFrom, dstTo),
    approvedLeave(ids, weekStart, addDays(weekStart, 6)),
    weeksRepository.entriesInRange(siteId, dstFrom, dstTo),
  ]);
  const templateOf = new Map(templates.map((t) => [t.id, t] as const));
  const employmentOf = new Map(employment.map((e) => [e.id, e] as const));
  const siteNames = await cellsRepository.siteNames(loans.map((l) => l.toSiteId));

  const plan = planCopy({
    source: sourceRows
      .filter((r) => byId.has(r.employeeId))
      .map((r) => ({ employeeId: r.employeeId, templateId: r.templateId, date: addDays(fromDateColumn(r.date), 7) })),
    names: new Map(writable.map((p) => [p.id, p.name] as const)),
    occupied: new Set(targetRows.map((r) => `${r.employeeId}|${fromDateColumn(r.date)}`)),
    today,
    clashOf: (employeeId, date, templateId) => {
      const person = byId.get(employeeId);
      const job = employmentOf.get(employeeId);
      if (!person || !job || !person.tracksTime || job.status === 'EXITED') return { kind: 'NOT_EMPLOYED', detail: 'No longer has shifts' };
      if (fromDateColumn(job.startDate) > date || (job.exitedOn && fromDateColumn(job.exitedOn) < date)) return { kind: 'NOT_EMPLOYED', detail: 'Not employed that day' };
      if (leave.get(employeeId)?.has(date)) return { kind: 'ON_LEAVE', detail: 'On approved leave' };
      const loan = loans.find((l) => l.employeeId === employeeId && fromDateColumn(l.startsOn) <= date && (!l.endsOn || fromDateColumn(l.endsOn) >= date));
      if (loan) return { kind: 'LOANED_OUT', detail: `Sent to ${siteNames.get(loan.toSiteId) ?? 'another site'} that day` };
      const template = templateOf.get(templateId);
      if (!template || !template.isActive || !templateFits(template, { siteId, departmentId: person.departmentId, departmentName: person.department?.name ?? null })) {
        return { kind: 'SHIFT_UNAVAILABLE', detail: 'That shift is no longer available' };
      }
      return null;
    },
  });
  return { plan, siteId, copiedFrom, weekStart, today };
}

export const copyService = {
  /** W-copy preview: "116 shifts, 31 people, 2 left out"; writes nothing. */
  async preview(subject: AccessSubject, body: CopyBody, now: Date = new Date()): Promise<CopyPreview> {
    const { plan, copiedFrom, weekStart } = await build(subject, body, now);
    // The copy never asks for a reason (owner, 24 Oct 2026: the reason is optional on every shift change); the field stays for old callers.
    return { clashes: plan.clashes, kept: plan.kept, shiftsCopied: plan.shiftsCopied, people: plan.people, skippedPast: plan.skippedPast, weekStart, copiedFrom, reasonRequired: false };
  },

  /** Copies into empty cells of the target week; occupied cells and clashes are left alone. One audit entry. */
  async copy(subject: AccessSubject, body: CopyBody, now: Date = new Date()): Promise<ApplyResult & { clashes: CopyPlan['clashes']; kept: number }> {
    const { plan, siteId, copiedFrom, weekStart } = await build(subject, body, now);
    if (plan.changes.length === 0) throw new ValidationError('Nothing to copy: last week has no shifts that fit', 'NOTHING_TO_COPY');
    const result = await applyCellChanges(
      subject,
      { siteId, changes: plan.changes, reason: body.reason, overrideReason: undefined, action: 'rota.week_copied', note: { weekStart, copiedFrom, clashes: plan.clashes.length, kept: plan.kept } },
      now,
    );
    return { ...result, clashes: plan.clashes, kept: plan.kept };
  },
};
