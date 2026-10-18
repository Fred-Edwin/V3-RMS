import { hmOf } from '../../_shared/lib/nairobi-clock';
import type { DayHistory } from '../../_shared/types/attendance-types';
import { SOURCE_WORDS } from '../lib/fix-model';

const STATUS: Record<string, string> = { COUNTS: 'Counts', REPLACED: 'Replaced', REMOVED: 'Removed', CORRECTION: 'Correction' };

/** Every clock event of the shift, old values included (the history keeps them all), with who recorded it and why. */
export function HistoryList({ history, entryId }: { history: DayHistory; entryId: string | null }) {
  const events = entryId === null ? history.unscheduled : (history.entries.find((e) => e.entryId === entryId)?.events ?? []);
  return (
    <section aria-label="History of this shift's clock events" className="flex flex-col gap-2">
      <h3 className="m-0 font-wds-mono text-[10px] font-normal leading-3 tracking-[0.06em] text-wds-text-secondary">HISTORY</h3>
      <ul className="m-0 flex list-none flex-col border border-wds-border p-0">
        {events.map((e) => (
          <li key={e.id} className="flex flex-col gap-0.5 border-b border-wds-neutral-100 px-3.5 py-2 last:border-b-0">
            <span className="font-wds-sans text-[13px] leading-4 text-wds-text-ink">
              {e.type === 'CORRECTION' ? 'Correction' : e.type === 'IN' ? 'Clock in' : 'Clock out'} · <span className="font-wds-mono">{hmOf(e.recordedAt)}</span> · {STATUS[e.status] ?? e.status}
            </span>
            <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
              {SOURCE_WORDS[e.source] ?? e.source}
              {e.recordedBy ? ` · ${e.recordedBy}` : ''}
              {e.reason ? ` · “${e.reason}”` : ''}
              {e.skewFlagged ? ' · the phone clock was wrong' : ''}
            </span>
          </li>
        ))}
        {events.length === 0 ? <li className="px-3.5 py-2 font-wds-sans text-[13px] leading-4 text-wds-text-secondary">Nothing recorded yet.</li> : null}
      </ul>
    </section>
  );
}
