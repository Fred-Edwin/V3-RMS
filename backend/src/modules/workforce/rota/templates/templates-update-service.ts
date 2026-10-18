import { ConflictError } from '../../../../utils/errors';
import { runAudited } from '../../_shared/audit/audit-writer';
import { fromDateColumn, nairobiToday, toDateColumn } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { resolveActor } from '../../people/people-context';
import { changeBatcher } from '../changes/change-batcher';
import { requireReasonWhenNeeded } from '../rota-days';
import type { TemplateView } from '../rota.types';
import { assertShiftWindow } from './template-rules';
import { assertFreeNameAndLetter, checkDepartments, loadWritable, templateEntry, viewOf } from './templates-service';
import { templatesRepository } from './templates-repository';
import type { TemplateUpdateBody } from './templates-validators';

/**
 * Changing a shift. Name, letter, colour and departments change in place. A change to the times or the break moves the
 * upcoming shifts (today onward) to the new times and tells each person; days already gone keep what was worked, so when the
 * shift has any past use the new times become a new version of the shift and the old one is retired (never edited).
 */
export const templatesUpdateService = {
  async update(subject: AccessSubject, id: string, body: TemplateUpdateBody, now: Date = new Date()): Promise<TemplateView> {
    const ctx = await resolveActor(subject);
    const template = await loadWritable(ctx, subject, id);
    if (!template.isActive) throw new ConflictError('This shift is retired; restore it first', 'TEMPLATE_RETIRED');

    const next = {
      name: body.name ?? template.name,
      letter: body.letter === undefined ? template.letter : body.letter,
      colour: body.colour ?? template.colour,
      startTime: body.startTime ?? template.startTime,
      endTime: body.endTime ?? template.endTime,
      unpaidBreakMinutes: body.unpaidBreakMinutes ?? template.unpaidBreakMinutes,
    };
    assertShiftWindow(next.startTime, next.endTime, next.unpaidBreakMinutes);
    if (body.departmentIds) await checkDepartments(ctx, template.siteId, body.departmentIds);
    const timesChanged =
      next.startTime !== template.startTime || next.endTime !== template.endTime || next.unpaidBreakMinutes !== template.unpaidBreakMinutes;
    const today = nairobiToday(now);
    const from = toDateColumn(today);

    const outcome = await runAudited(async (tx) => {
      if (next.name !== template.name || next.letter !== template.letter) {
        await assertFreeNameAndLetter(tx, ctx, { siteId: template.siteId, name: next.name, letter: next.letter, exceptId: id });
      }
      const upcoming = timesChanged ? await templatesRepository.entriesFrom(tx, id, from) : [];
      const reason = requireReasonWhenNeeded(upcoming.map((e) => fromDateColumn(e.date)), today, body.reason);
      let targetId = id;
      if (timesChanged && (await templatesRepository.hasEntriesBefore(tx, id, from))) {
        const successor = await templatesRepository.create(tx, { companyId: ctx.companyId, siteId: template.siteId, createdById: subject.id, ...next });
        const departmentIds = body.departmentIds ?? template.departments.map((d) => d.department.id);
        await templatesRepository.replaceDepartments(tx, successor.id, departmentIds);
        await templatesRepository.update(tx, id, { isActive: false, retiredAt: now, supersededById: successor.id });
        await templatesRepository.moveEntriesFrom(tx, id, successor.id, from);
        targetId = successor.id;
      } else {
        await templatesRepository.update(tx, id, next);
        if (body.departmentIds) await templatesRepository.replaceDepartments(tx, id, body.departmentIds);
      }
      const before = { name: template.name, start: template.startTime, end: template.endTime, breakMinutes: template.unpaidBreakMinutes };
      const after = { name: next.name, start: next.startTime, end: next.endTime, breakMinutes: next.unpaidBreakMinutes, shiftsMoved: upcoming.length, newVersion: targetId !== id };
      return {
        result: { targetId, upcoming },
        entries: [templateEntry(ctx, { id: targetId, siteId: template.siteId }, { action: 'rota.template_updated', before, after, reason })],
      };
    });

    changeBatcher.record(
      outcome.upcoming.map((e) => ({ siteId: e.siteId, employeeId: e.employee.id, userId: e.employee.userId, date: fromDateColumn(e.date), changedById: subject.id })),
    );
    return viewOf(ctx, outcome.targetId);
  },
};
