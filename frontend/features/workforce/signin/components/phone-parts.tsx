import { Delete } from 'lucide-react';

import { cn } from '@/lib/cn';
import { PHONE_SUPPORT_LINE, WHATSAPP_URL } from '../lib/signin-rules';

/** The parts only the phone frames draw (Paper 4.2 to 4.5, 390 px): the two-line support strip and the number pad on the page. */

/** "Need help? +254 113 176 613 · 6 a.m. to 10 p.m." and "Built and supported by Fred". `ruled`: a hairline above, as on Welcome back. */
export function PhoneSupport({ ruled = false }: { ruled?: boolean }): JSX.Element {
  return (
    <div className={cn('flex flex-col items-center gap-[3px] lg:hidden', ruled && 'border-t border-wds-border pt-3.5')}>
      <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="text-center text-xs leading-4 text-wds-neutral-700">
        {PHONE_SUPPORT_LINE}
      </a>
      <span className="text-[11px] leading-[14px] text-[#847E76]">Built and supported by Fred</span>
    </div>
  );
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const KEY = 'flex h-[46px] items-center justify-center rounded-[4px] bg-wds-neutral-50 text-[21px] leading-[26px] text-wds-text-ink transition-transform duration-100 ease-out focus-visible:outline-none focus-visible:shadow-wds-ring motion-safe:active:scale-[0.97] disabled:opacity-50';

/** The number pad of the phone Set your PIN frame: 1 to 9, a gap, 0 and delete. The real input stays under it for a keyboard and paste. */
export function PinPad({ onDigit, onDelete, disabled }: { onDigit: (digit: string) => void; onDelete: () => void; disabled?: boolean }): JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-2 lg:hidden" role="group" aria-label="Number pad">
      {DIGITS.map((d) => (
        <button key={d} type="button" className={KEY} disabled={disabled} onClick={() => onDigit(d)}>
          {d}
        </button>
      ))}
      <span aria-hidden />
      <button type="button" className={KEY} disabled={disabled} onClick={() => onDigit('0')}>
        0
      </button>
      <button type="button" className={KEY} disabled={disabled} onClick={onDelete} aria-label="Delete the last digit">
        <Delete size={22} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
