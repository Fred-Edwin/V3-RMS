import type { TrackerRow } from '../../_shared/components/block2-phone-parts';
import { personComma } from '../../_shared/lib/block2-words';
import { whenText } from '../../dispatch/lib/file-logic';
import type { ChipSpec } from '../../_shared/lib/block2-words';
import type { DispatchFile } from '../../dispatch/_shared/types/dispatch-contract';
import { resultChip } from '../../_shared/lib/block2-words';

/** The department's tracker (N3a, N3b): packed and signed, arrived, counted and signed, and the Store Manager's finding. */
export function deliveryTrackerRows(file: Pick<DispatchFile, 'signed' | 'carrier' | 'arrivedAt' | 'counted' | 'items' | 'activity'>, now: Date = new Date()): TrackerRow[] {
  const rows: TrackerRow[] = [];
  rows.push({ key: 'p', title: 'Packed and signed', line: `${whenText(file.signed.at, now)} · ${personComma(file.signed.by)}`, state: 'DONE' });
  if (file.arrivedAt) rows.push({ key: 'a', title: 'Arrived', line: `${whenText(file.arrivedAt, now)} · ${file.carrier.name}`, state: 'DONE' });
  if (file.counted) rows.push({ key: 'c', title: 'Counted and signed', line: `${whenText(file.counted.at, now)} · ${personComma(file.counted.by)}`, state: 'DONE' });
  const gap = file.items.some((i) => i.discrepancy !== null);
  if (gap) {
    const open = file.items.some((i) => i.discrepancy && i.discrepancy.status !== 'RECORDED');
    const recorded = [...file.activity].filter((e) => e.type === 'FINDING_RECORDED').sort((a, b) => b.at.localeCompare(a.at))[0];
    rows.push(
      open || !recorded
        ? { key: 's', title: 'Store Manager records what happened', line: 'Not yet', state: 'TODO' }
        : { key: 's', title: 'Store Manager recorded what happened', line: `${whenText(recorded.at, now)} · ${personComma(recorded.actor)}`, state: 'DONE' },
    );
  }
  return rows;
}

/** The chip under the header (N3): "1 gap · open", "1 gap · resolved", "All matched". */
export function deliveryFileChip(file: Pick<DispatchFile, 'items'>): ChipSpec | null {
  const gaps = file.items.filter((i) => i.discrepancy !== null);
  if (file.items.every((i) => i.countedQty === null)) return null;
  if (gaps.length === 0) return resultChip('MATCHED', 0);
  const open = gaps.filter((g) => g.discrepancy && g.discrepancy.status !== 'RECORDED').length;
  if (open === 0) return resultChip('GAP_RESOLVED', gaps.length);
  return gaps.length > 1 && open < gaps.length ? { text: `${gaps.length} gaps · ${open} open`, tone: 'warning' } : resultChip('GAP_OPEN', gaps.length);
}
