import { plainName } from '../../_shared/lib/block2-words';
import type { DeliveryRow } from '../_shared/types/deliveries-contract';

/** What a head's home card says about today's delivery for a cycle (Paper chapter 14, B). */
export interface DeliveryHomeState {
  deliveryId: string;
  /** The big line: "On the way", "Counted, 1 line differs", "Counted for you". */
  title: string;
  body: string;
  /** True while nobody has counted it: the card's button reads "Count it now". */
  canCount: boolean;
}

const plural = (n: number): string => `${n} ${n === 1 ? 'line' : 'lines'}`;

/**
 * The state of one delivery in words. `timeText` formats an ISO time the way the screens do ("11:20 am"). Null for a delivery that
 * was cancelled or never left, so the card keeps saying what the requisition says.
 */
export function deliveryHomeState(row: DeliveryRow, timeText: (iso: string) => string): DeliveryHomeState | null {
  if (row.stage === 'CANCELLED' || row.stage === 'TO_PACK' || row.stage === 'PACKING' || row.stage === 'READY_TO_SEND') return null;
  if (row.confirmedAt === null) {
    const arrived = row.arrivedAt !== null || row.stage === 'WAITING_FOR_BRANCH';
    return {
      deliveryId: row.id,
      title: row.stage === 'WAITING_FOR_BRANCH' ? 'Waiting for the branch' : arrived ? 'Arrived' : 'On the way',
      body: `Left the store at ${timeText(row.signedAt)} with ${row.carrier.name}.`,
      canCount: row.can.count || row.can.confirmOnBehalf,
    };
  }
  const at = timeText(row.confirmedAt);
  const differing = row.gapCount ?? 0;
  const forYou = row.confirmedByTitle !== null && /branch manager/i.test(row.confirmedByTitle);
  const looking = row.result === 'GAP_OPEN' ? ' The Store Manager is looking into it.' : row.result === 'GAP_RESOLVED' ? ' The Store Manager has settled it.' : '';
  const outcome = differing > 0 ? `${plural(differing)} ${differing === 1 ? 'differs' : 'differ'}.${looking}` : 'Everything matched.';
  if (forYou && row.confirmedBy) {
    return {
      deliveryId: row.id,
      title: 'Counted for you',
      body: `${plainName(row.confirmedBy.name)}, ${row.confirmedByTitle}, counted it for ${row.department.name} at ${at}. ${outcome}`,
      canCount: false,
    };
  }
  return {
    deliveryId: row.id,
    title: differing > 0 ? `Counted, ${plural(differing)} ${differing === 1 ? 'differs' : 'differ'}` : 'Counted',
    body: differing > 0 ? `You counted it at ${at}.${looking}` : `You counted it at ${at}. Everything matched.`,
    canCount: false,
  };
}

/** The delivery for a cycle: the newest one signed today (waiting ones first, so a delivery still to count is never hidden). */
export function deliveryForCycle(rows: readonly DeliveryRow[], cycle: DeliveryRow['cycle']): DeliveryRow | null {
  const mine = rows.filter((r) => r.cycle === cycle);
  const open = mine.find((r) => r.confirmedAt === null && r.stage !== 'CANCELLED');
  if (open) return open;
  return [...mine].sort((a, b) => b.signedAt.localeCompare(a.signedAt))[0] ?? null;
}
