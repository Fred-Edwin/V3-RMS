import { describe, expect, it } from 'vitest';

import type { DeliveryRow } from '../_shared/types/deliveries-contract';
import { deliveryForCycle, deliveryHomeState } from './home-state';

const time = (iso: string): string => iso.slice(11, 16);
const row = (over: Partial<DeliveryRow>): DeliveryRow =>
  ({
    id: 'd1',
    reference: 'DSP-NYR-0004',
    department: { id: 'k', name: 'Kitchen' },
    cycle: 'MORNING',
    carrier: { id: 'c', name: 'Wendo van KCB 214K' },
    lineCount: 2,
    signedAt: '2026-10-11T10:40:00.000Z',
    arrivedAt: null,
    stage: 'ON_THE_WAY',
    countStarted: false,
    confirmedAt: null,
    confirmedBy: null,
    confirmedByTitle: null,
    result: null,
    gapCount: null,
    can: { count: true, confirmOnBehalf: false },
    ...over,
  }) as DeliveryRow;

describe('head home delivery state (Paper chapter 14, B)', () => {
  it('says on the way, with the time and carrier, and offers the count', () => {
    const state = deliveryHomeState(row({}), time);
    expect(state).toMatchObject({ title: 'On the way', canCount: true });
    expect(state?.body).toBe('Left the store at 10:40 with Wendo van KCB 214K.');
  });

  it('says counted with the number of lines that differ and who is looking', () => {
    const state = deliveryHomeState(row({ stage: 'GAP_HELD', confirmedAt: '2026-10-11T11:20:00.000Z', gapCount: 1, result: 'GAP_OPEN' }), time);
    expect(state?.title).toBe('Counted, 1 line differs');
    expect(state?.body).toContain('The Store Manager is looking into it.');
    expect(state?.canCount).toBe(false);
  });

  it('says counted for you when the Branch Manager counted', () => {
    const state = deliveryHomeState(row({ stage: 'CONFIRMED', confirmedAt: '2026-10-11T14:05:00.000Z', gapCount: 0, confirmedBy: { id: 'u', name: 'Faith Njeri (Branch Manager)', initials: 'FN', roleLabel: 'Branch Manager' }, confirmedByTitle: 'Branch Manager' }), time);
    expect(state?.title).toBe('Counted for you');
    expect(state?.body).toBe('Faith Njeri, Branch Manager, counted it for Kitchen at 14:05. Everything matched.');
  });

  it('leaves a cancelled delivery to the requisition', () => {
    expect(deliveryHomeState(row({ stage: 'CANCELLED' }), time)).toBeNull();
  });

  it('prefers a delivery still to count', () => {
    const counted = row({ id: 'a', stage: 'CONFIRMED', confirmedAt: '2026-10-11T11:00:00.000Z' });
    const open = row({ id: 'b' });
    expect(deliveryForCycle([counted, open], 'MORNING')?.id).toBe('b');
    expect(deliveryForCycle([counted], 'AFTERNOON')).toBeNull();
  });
});
