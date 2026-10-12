import { describe, expect, it } from 'vitest';
import { rollUpOf, type RollUpRow } from './dispatch-roll-up';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000);
const row = (over: Partial<RollUpRow> & { name: string; position: number }): RollUpRow => ({
  id: `id-${over.name}`,
  reference: null,
  status: 'TO_PACK',
  signedAt: null,
  countedAt: null,
  departmentId: `dept-${over.name}`,
  department: { name: over.name, position: over.position },
  carrier: null,
  lines: [{ packedTick: false }],
  discrepancies: [],
  ...over,
});

describe('rollUpOf', () => {
  it('"n of m sent": departments with a signed dispatch of those that have a live one, in department order', () => {
    const r = rollUpOf(
      [
        row({ name: 'Pastry', position: 2 }),
        row({ name: 'Kitchen', position: 1, status: 'ON_THE_WAY', reference: 'DSP-NYR-0001', signedAt: ago(30), carrier: { name: 'Van' } }),
      ],
      NOW,
    );
    expect(r.dispatches.map((d) => d.departmentName)).toEqual(['Kitchen', 'Pastry']);
    expect(r.tracker).toMatchObject({ total: 2, sent: 1, counted: 0, sentAt: null, countedAt: null });
    expect(r.dispatches[0]).toMatchObject({ reference: 'DSP-NYR-0001', derivedState: 'ON_THE_WAY', carrierName: 'Van', lineCount: 1 });
    expect(r.dispatches[1]).toMatchObject({ reference: null, signedAt: null, carrierName: null, derivedState: 'TO_PACK' });
  });

  it('the step dates appear only when every department has reached the step, and are the latest of them', () => {
    const r = rollUpOf(
      [
        row({ name: 'Kitchen', position: 1, status: 'CONFIRMED', signedAt: ago(300), countedAt: ago(100) }),
        row({ name: 'Pastry', position: 2, status: 'CONFIRMED', signedAt: ago(200), countedAt: ago(50) }),
      ],
      NOW,
    );
    expect(r.tracker).toMatchObject({ total: 2, sent: 2, counted: 2, sentAt: ago(200), countedAt: ago(50) });
  });

  it('a department waiting over 2 hours reads Waiting for the branch, a held gap reads Gap held, a ticked unsigned one Ready to send', () => {
    const r = rollUpOf(
      [
        row({ name: 'A', position: 1, status: 'ON_THE_WAY', signedAt: ago(130) }),
        row({ name: 'B', position: 2, status: 'CONFIRMED', signedAt: ago(300), countedAt: ago(10), discrepancies: [{ status: 'OPEN' }] }),
        row({ name: 'C', position: 3, status: 'PACKING', lines: [{ packedTick: true }] }),
      ],
      NOW,
    );
    expect(r.dispatches.map((d) => d.derivedState)).toEqual(['WAITING_FOR_BRANCH', 'GAP_HELD', 'READY_TO_SEND']);
  });

  it('no dispatch yet gives an empty roll-up with total 0 (the tracker keeps Packed and Delivered to do)', () => {
    expect(rollUpOf([], NOW)).toEqual({ dispatches: [], tracker: { total: 0, sent: 0, counted: 0, sentAt: null, countedAt: null } });
  });
});
