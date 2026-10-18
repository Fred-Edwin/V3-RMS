import { describe, expect, it } from 'vitest';
import { boardQuerySchema, clockForSchema } from './board/board-validators';
import { clockInSchema, clockOutSchema, shiftEndSchema, undoSchema } from './clock/clock-validators';
import { dayQuerySchema, fixSchema } from './fixes/fixes-validators';
import { latenessQuerySchema } from './lateness/lateness-validators';

const id = '0b8d3c6e-5f7a-4c1e-9d3a-2f4e6a8b0c12';

describe('clock bodies', () => {
  it('a tap needs an idempotency key; times arrive as instants and become dates', () => {
    expect(clockInSchema.safeParse({}).success).toBe(false);
    expect(clockInSchema.safeParse({ clientEventId: 'short' }).success).toBe(false);
    const ok = clockInSchema.parse({ clientEventId: 'tap-0001-abcd', deviceAt: '2026-10-12T05:58:00+03:00', sentAt: '2026-10-12T05:58:02+03:00', latitude: -0.42, longitude: 36.95 });
    expect(ok.deviceAt).toEqual(new Date('2026-10-12T02:58:00.000Z'));
  });

  it('position is both coordinates or neither, and unknown fields are refused', () => {
    expect(clockInSchema.safeParse({ clientEventId: 'tap-0001-abcd', latitude: -0.42 }).success).toBe(false);
    expect(clockInSchema.safeParse({ clientEventId: 'tap-0001-abcd', latitude: 95, longitude: 36.9 }).success).toBe(false);
    expect(clockInSchema.safeParse({ clientEventId: 'tap-0001-abcd', userId: id }).success).toBe(false);
    expect(clockInSchema.safeParse({ clientEventId: 'tap-0001-abcd', deviceAt: 'yesterday' }).success).toBe(false);
  });

  it('clock-out may carry an early-leave reason; undo needs only the key; stay-on needs a chip', () => {
    expect(clockOutSchema.parse({ clientEventId: 'tap-0002-abcd', reasonCode: 'UNWELL', reason: ' Headache ' }).reason).toBe('Headache');
    expect(undoSchema.safeParse({ clientEventId: 'undo-0001' }).success).toBe(true);
    expect(shiftEndSchema.safeParse({ rotaEntryId: id, answer: 'STAY_ON', reasonCode: 'BUSY', estimateMinutes: 30 }).success).toBe(true);
    expect(shiftEndSchema.safeParse({ rotaEntryId: id, answer: 'STAY_ON', reasonCode: 'LAZY' }).success).toBe(false);
    expect(shiftEndSchema.safeParse({ rotaEntryId: id, answer: 'STAY_ON', reasonCode: 'BUSY', estimateMinutes: 20 }).success).toBe(false);
    expect(shiftEndSchema.safeParse({ rotaEntryId: id, answer: 'FINISH_NOW', reasonCode: 'BUSY' }).success).toBe(false);
  });
});

describe('board, fixes and lateness inputs', () => {
  const at = '2026-10-12T06:15:00+03:00';
  it('clocking someone needs a time and a reason, both', () => {
    expect(clockForSchema.safeParse({ employeeId: id, type: 'IN', at, reason: 'Phone battery died' }).success).toBe(true);
    expect(clockForSchema.safeParse({ employeeId: id, type: 'IN', at }).success).toBe(false);
    expect(clockForSchema.safeParse({ employeeId: id, type: 'IN', reason: 'x'.repeat(2), at }).success).toBe(false);
    expect(clockForSchema.safeParse({ employeeId: id, type: 'IN', at: '06:15', reason: 'Phone battery died' }).success).toBe(false);
  });

  it('a fix is one of three actions and always carries a reason', () => {
    const base = { employeeId: id, date: '2026-10-08', reason: 'Forgot to tap out' };
    expect(fixSchema.safeParse({ ...base, action: 'EDIT', eventId: id, at }).success).toBe(true);
    expect(fixSchema.safeParse({ ...base, action: 'ADD', type: 'OUT', at }).success).toBe(true);
    expect(fixSchema.safeParse({ ...base, action: 'VOID', eventId: id }).success).toBe(true);
    expect(fixSchema.safeParse({ ...base, action: 'EDIT', eventId: id }).success).toBe(false); // no new time
    expect(fixSchema.safeParse({ ...base, reason: '', action: 'VOID', eventId: id }).success).toBe(false);
    expect(fixSchema.safeParse({ ...base, action: 'DELETE', eventId: id }).success).toBe(false);
    expect(fixSchema.safeParse({ ...base, date: '08-10-2026', action: 'VOID', eventId: id }).success).toBe(false);
  });

  it('the board, day and lateness queries take Nairobi dates', () => {
    expect(boardQuerySchema.parse({ date: '2026-10-12' }).date).toBe('2026-10-12');
    expect(boardQuerySchema.safeParse({ date: '2026-13-40' }).success).toBe(false);
    expect(dayQuerySchema.safeParse({ employeeId: id, date: '2026-10-12' }).success).toBe(true);
    expect(latenessQuerySchema.parse({ from: '2026-10-01', to: '2026-10-12', includeOnTime: 'true' }).includeOnTime).toBe(true);
    expect(latenessQuerySchema.safeParse({ from: '2026-10-01' }).success).toBe(false);
  });
});
