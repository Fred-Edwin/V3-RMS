import { describe, expect, it } from 'vitest';
import {
  AssignHeadSchema,
  DepartmentCreateSchema,
  DepartmentUpdateSchema,
  EndHeadSchema,
  PositionCreateSchema,
  PositionImpactQuerySchema,
  PositionUpdateSchema,
  PositionsQuerySchema,
} from './org-validators';

const id = '0b8d3c6e-5f7a-4c1e-9d3a-2f4e6a8b0c12';

describe('Organisation validators', () => {
  it('a department needs a site and a name; positions default to none and are listed once', () => {
    expect(DepartmentCreateSchema.parse({ siteId: id, name: '  Bakery ' })).toEqual({ siteId: id, name: 'Bakery', positionIds: [] });
    expect(DepartmentCreateSchema.safeParse({ siteId: id, name: '' }).success).toBe(false);
    expect(DepartmentCreateSchema.safeParse({ siteId: 'x', name: 'Bakery' }).success).toBe(false);
    expect(DepartmentCreateSchema.safeParse({ siteId: id, name: 'Bakery', positionIds: [id, id] }).success).toBe(false);
  });

  it('an edit must change something', () => {
    expect(DepartmentUpdateSchema.safeParse({}).success).toBe(false);
    expect(DepartmentUpdateSchema.safeParse({ description: null }).success).toBe(true);
  });

  it('a new head has no return day; an acting head must have one', () => {
    expect(AssignHeadSchema.safeParse({ employeeId: id, mode: 'REPLACE' }).success).toBe(true);
    expect(AssignHeadSchema.safeParse({ employeeId: id, mode: 'REPLACE', returnsOn: '2026-10-30' }).success).toBe(false);
    expect(AssignHeadSchema.safeParse({ employeeId: id, mode: 'ACTING' }).success).toBe(false);
    expect(AssignHeadSchema.safeParse({ employeeId: id, mode: 'ACTING', returnsOn: '30/10/2026' }).success).toBe(false);
    expect(AssignHeadSchema.parse({ employeeId: id, mode: 'ACTING', returnsOn: '2026-10-30' }).replaceActing).toBe(false);
    expect(AssignHeadSchema.safeParse({ employeeId: id, mode: 'OTHER' }).success).toBe(false);
  });

  it('ending a head needs a reason; it defaults to the head, not the acting head', () => {
    expect(EndHeadSchema.safeParse({}).success).toBe(false);
    expect(EndHeadSchema.parse({ reason: 'Left' }).which).toBe('HEAD');
    expect(EndHeadSchema.safeParse({ reason: 'x', which: 'BOTH' }).success).toBe(false);
  });

  it('a position names whether it clocks in; the login role is a real role, never the System Admin', () => {
    expect(PositionCreateSchema.parse({ name: 'Baker', defaultTracksTime: true })).toMatchObject({ loginRole: null, casualsAllowed: true, departmentIds: [] });
    expect(PositionCreateSchema.safeParse({ name: 'Baker' }).success).toBe(false);
    expect(PositionCreateSchema.safeParse({ name: 'Baker', defaultTracksTime: true, loginRole: 'SYSTEM_ADMIN' }).success).toBe(false);
  });

  it('a position edit cannot be only the acknowledgement', () => {
    expect(PositionUpdateSchema.safeParse({ acknowledgedPeople: 3 }).success).toBe(false);
    expect(PositionUpdateSchema.safeParse({ defaultTracksTime: false, acknowledgedPeople: 3 }).success).toBe(true);
    expect(PositionUpdateSchema.safeParse({ acknowledgedPeople: -1, name: 'x' }).success).toBe(false);
  });

  it('queries: true/false strings, defaults', () => {
    expect(PositionsQuerySchema.parse({})).toEqual({ includeRetired: false });
    expect(PositionsQuerySchema.parse({ includeRetired: 'true' }).includeRetired).toBe(true);
    expect(PositionImpactQuerySchema.parse({ defaultTracksTime: 'false' }).defaultTracksTime).toBe(false);
    expect(PositionImpactQuerySchema.safeParse({}).success).toBe(false);
  });
});
