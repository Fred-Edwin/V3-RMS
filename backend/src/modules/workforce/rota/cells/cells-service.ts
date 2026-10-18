import { isoWeekday, type NairobiDate } from '../../_shared/time/nairobi-time';
import type { AccessSubject } from '../../_shared/workforce-access';
import { weekDaysOf } from '../rota-days';
import type { CellChange } from '../rota.types';
import { applyCellChanges, type ApplyResult } from './cells-apply';
import type { FillBody, PatternBody, SetCellsBody } from './cells-validators';

/** C1 to C3: set or clear cells, the brush, and a standing pattern. All three end in the one write path. */
export const cellsService = {
  setCells(subject: AccessSubject, body: SetCellsBody, now: Date = new Date()): Promise<ApplyResult> {
    const changes: CellChange[] = body.changes.map((c) => ({ employeeId: c.employeeId, date: c.date as NairobiDate, templateIds: c.templateIds }));
    return applyCellChanges(subject, { siteId: body.siteId, changes, reason: body.reason, overrideReason: body.overrideReason, action: 'rota.cells_changed' }, now);
  },

  fill(subject: AccessSubject, body: FillBody, now: Date = new Date()): Promise<ApplyResult> {
    const changes: CellChange[] = body.employeeIds.flatMap((employeeId) =>
      body.dates.map((date) => ({ employeeId, date: date as NairobiDate, templateIds: body.templateId ? [body.templateId] : [] })),
    );
    return applyCellChanges(subject, { siteId: body.siteId, changes, reason: body.reason, overrideReason: body.overrideReason, action: 'rota.cells_changed', note: { fill: true } }, now);
  },

  pattern(subject: AccessSubject, body: PatternBody, now: Date = new Date()): Promise<ApplyResult> {
    const days = weekDaysOf(body.weekStart as NairobiDate);
    const changes: CellChange[] = body.employeeIds.flatMap((employeeId) =>
      days.flatMap((date) => {
        const key = String(isoWeekday(date)) as '1';
        if (!(key in body.byWeekday)) return [];
        const templateId = body.byWeekday[key];
        return [{ employeeId, date, templateIds: templateId ? [templateId] : [] }];
      }),
    );
    return applyCellChanges(subject, { siteId: body.siteId, changes, reason: body.reason, overrideReason: body.overrideReason, action: 'rota.cells_changed', note: { pattern: true } }, now);
  },
};
