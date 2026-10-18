import { z } from 'zod';
import { MAX_SHIFTS_PER_DAY } from '../rota.constants';
import { idField, nairobiDateField, reasonField } from '../rota-fields';

const common = { siteId: idField.optional(), reason: reasonField.optional(), overrideReason: reasonField.optional() };
const templateIds = z.array(idField).max(MAX_SHIFTS_PER_DAY).refine((ids) => new Set(ids).size === ids.length, 'A shift is listed once a day');

/** Set or clear any cells: a day with no templateIds is a day off. */
export const SetCellsSchema = z.object({
  ...common,
  changes: z.array(z.object({ employeeId: idField, date: nairobiDateField, templateIds })).min(1).max(400),
});

/** The brush: one shift (or a day off) across some people and days. */
export const FillSchema = z.object({
  ...common,
  employeeIds: z.array(idField).min(1).max(100),
  dates: z.array(nairobiDateField).min(1).max(31),
  templateId: idField.nullable(),
});

/** A standing pattern: one shift per weekday (1 = Monday), repeated across a week for chosen people. */
export const PatternSchema = z.object({
  ...common,
  employeeIds: z.array(idField).min(1).max(100),
  weekStart: nairobiDateField,
  byWeekday: z.partialRecord(z.enum(['1', '2', '3', '4', '5', '6', '7']), idField.nullable()),
});

export type SetCellsBody = z.infer<typeof SetCellsSchema>;
export type FillBody = z.infer<typeof FillSchema>;
export type PatternBody = z.infer<typeof PatternSchema>;
