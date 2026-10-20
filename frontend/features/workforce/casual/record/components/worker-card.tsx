import { cn } from '@/lib/cn';

import { FOCUS_RING, MOTION, onHover } from '../../../_shared';
import { dayPay, shiftMinutes, timeRange } from '../../_shared/lib/casual-pay';
import type { DraftLine } from '../../_shared/types/casual-types';

/**
 * One worker on the day (Paper 3AOM-0): name, "07:00 to 15:00 · 8 h", the pay at the right. A button only while the sheet can be edited.
 * The amount drops under the time on a very small phone or a large font. Read aloud as one sentence.
 */
export function WorkerCard({ line, rate, onEdit }: { line: DraftLine; rate: string; onEdit?: () => void }) {
  const minutes = Math.max(0, shiftMinutes(line.start, line.end, line.endsNextDay));
  const pay = dayPay(rate, minutes);
  const range = timeRange(line.start, line.end, line.endsNextDay);
  const body = (
    <>
      <span className="flex min-w-0 flex-col">
        <span className="font-wds-sans text-[15px] font-semibold leading-[18px] text-wds-text-ink">{line.name}</span>
        <span className="font-wds-mono text-[12px] leading-4 text-wds-text-secondary">{range}</span>
      </span>
      <span className="font-wds-mono text-[14px] leading-[18px] text-wds-text-ink">{pay.toLocaleString('en-US')}</span>
    </>
  );
  const label = `${line.name}, ${range.replace(' · ', ', ')}, ${pay} shillings`;
  const frame = 'flex min-h-[56px] w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 border border-wds-border bg-wds-surface px-3.5 py-3 text-left';
  return (
    <li>
      {onEdit ? (
        <button type="button" aria-label={label} onClick={onEdit} className={cn(frame, MOTION, FOCUS_RING, onHover('bg-wds-neutral-50'))}>
          {body}
        </button>
      ) : (
        <div role="group" aria-label={label} className={frame}>
          {body}
        </div>
      )}
    </li>
  );
}
