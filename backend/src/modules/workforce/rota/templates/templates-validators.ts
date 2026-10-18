import { z } from 'zod';
import { SHIFT_COLOURS } from '../rota.constants';
import { clockTimeField, flagField, idField, nairobiDateField, reasonField } from '../rota-fields';

const name = z.string().trim().min(1).max(40);
const letter = z
  .string()
  .trim()
  .regex(/^[A-Za-z]$/, 'One letter')
  .transform((value) => value.toUpperCase());
const departmentIds = z.array(idField).max(60).refine((ids) => new Set(ids).size === ids.length, 'A department is listed once');
const breakMinutes = z.number().int().min(0).max(240);

export const TemplatesQuerySchema = z.object({
  siteId: idField.optional(),
  weekStart: nairobiDateField.optional(),
  includeRetired: flagField.default(false),
});

export const TemplateCreateSchema = z.object({
  /** Null = company-wide (HR and the Director). A Branch Manager sends their own site. */
  siteId: idField.nullable(),
  name,
  letter: letter.optional(),
  colour: z.enum(SHIFT_COLOURS),
  startTime: clockTimeField,
  endTime: clockTimeField,
  unpaidBreakMinutes: breakMinutes.default(0),
  departmentIds: departmentIds.default([]),
});

export const TemplateUpdateSchema = z
  .object({
    name: name.optional(),
    letter: letter.nullable().optional(),
    colour: z.enum(SHIFT_COLOURS).optional(),
    startTime: clockTimeField.optional(),
    endTime: clockTimeField.optional(),
    unpaidBreakMinutes: breakMinutes.optional(),
    departmentIds: departmentIds.optional(),
    /** Needed when the change moves a shift that is today or tomorrow. */
    reason: reasonField.optional(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== 'reason'), 'Nothing to change');

export type TemplatesQuery = z.infer<typeof TemplatesQuerySchema>;
export type TemplateCreateBody = z.infer<typeof TemplateCreateSchema>;
export type TemplateUpdateBody = z.infer<typeof TemplateUpdateSchema>;
