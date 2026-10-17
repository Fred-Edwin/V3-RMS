import { z } from 'zod';
import { POSITION_LOGIN_ROLES } from '../people.constants';

const id = z.uuid();
const nairobiDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const name = (max: number) => z.string().trim().min(1).max(max);
const paging = { page: z.coerce.number().int().min(1).default(1), perPage: z.coerce.number().int().min(1).max(100).default(50) };
const flag = z.enum(['true', 'false']).transform((value) => value === 'true');

// ---- params and queries ---------------------------------------------------------------------------
export const OrgIdParamsSchema = z.object({ id });
export const OverviewQuerySchema = z.object({ includeRetired: flag.default(false) });
export const DepartmentQuerySchema = z.object(paging);
export const PositionsQuerySchema = z.object({
  departmentId: id.optional(),
  includeRetired: flag.default(false),
  q: z.string().trim().max(80).optional(),
});
export const PositionImpactQuerySchema = z.object({ defaultTracksTime: flag });

// ---- departments ----------------------------------------------------------------------------------
const description = z.string().trim().max(200);
const positionIds = z.array(id).max(60).refine((ids) => new Set(ids).size === ids.length, 'A position is listed once');

export const DepartmentCreateSchema = z.object({
  siteId: id,
  name: name(60),
  description: description.optional(),
  positionIds: positionIds.default([]),
});

export const DepartmentUpdateSchema = z
  .object({ name: name(60).optional(), description: description.nullable().optional(), positionIds: positionIds.optional() })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to change');

// ---- heads ----------------------------------------------------------------------------------------
export const AssignHeadSchema = z
  .object({
    employeeId: id,
    mode: z.enum(['REPLACE', 'ACTING']),
    /** The day the substantive head is back; the acting row ends the day before. */
    returnsOn: nairobiDate.optional(),
    /** With ACTING: replace an acting head who is already named. */
    replaceActing: z.boolean().default(false),
    reason: name(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'ACTING' && !value.returnsOn) ctx.addIssue({ code: 'custom', path: ['returnsOn'], message: 'An acting head needs the day the head returns' });
    if (value.mode === 'REPLACE' && value.returnsOn) ctx.addIssue({ code: 'custom', path: ['returnsOn'], message: 'A new head has no return date' });
  });

export const EndHeadSchema = z.object({
  which: z.enum(['HEAD', 'ACTING']).default('HEAD'),
  reason: name(200),
});

// ---- positions ------------------------------------------------------------------------------------
export const PositionCreateSchema = z.object({
  name: name(60),
  defaultTracksTime: z.boolean(),
  loginRole: z.enum(POSITION_LOGIN_ROLES).nullable().default(null),
  casualsAllowed: z.boolean().default(true),
  departmentIds: z.array(id).max(60).default([]),
});

export const PositionUpdateSchema = z
  .object({
    name: name(60).optional(),
    defaultTracksTime: z.boolean().optional(),
    loginRole: z.enum(POSITION_LOGIN_ROLES).nullable().optional(),
    casualsAllowed: z.boolean().optional(),
    departmentIds: z.array(id).max(60).optional(),
    /** Must equal the number of people the change would touch (from the impact call) when "clocks in" changes. */
    acknowledgedPeople: z.number().int().min(0).optional(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== 'acknowledgedPeople'), 'Nothing to change');

export type DepartmentCreateBody = z.infer<typeof DepartmentCreateSchema>;
export type DepartmentUpdateBody = z.infer<typeof DepartmentUpdateSchema>;
export type AssignHeadBody = z.infer<typeof AssignHeadSchema>;
export type EndHeadBody = z.infer<typeof EndHeadSchema>;
export type PositionCreateBody = z.infer<typeof PositionCreateSchema>;
export type PositionUpdateBody = z.infer<typeof PositionUpdateSchema>;
export type PositionsQuery = z.infer<typeof PositionsQuerySchema>;
export type DepartmentQuery = z.infer<typeof DepartmentQuerySchema>;
