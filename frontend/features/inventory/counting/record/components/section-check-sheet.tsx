'use client';

import * as React from 'react';

import { BottomSheet, SheetGrabber } from '../../../_shared/components/bottom-sheet';
import { PHONE_PRIMARY_BUTTON, PHONE_SECONDARY_BUTTON } from '../../../_shared/lib/phone-styles';
import { cn } from '@/lib/cn';
import type { CheckResult } from '../../_shared/types/counting-contract';

/**
 * Section done, check items again (Paper step 3, `1WM9-0`): a sheet over the count that names the items whose numbers look
 * different from what the system expects, with the number she typed and nothing else (no expected figure, no direction). A
 * second look is offered once; "Continue as counted" is always allowed and nobody asks again.
 */
export function SectionCheckSheet({
  check,
  onRecount,
  onContinue,
}: {
  check: Pick<CheckResult, 'items' | 'text'> | null;
  onRecount: () => void;
  onContinue: () => void;
}) {
  const recountRef = React.useRef<HTMLButtonElement>(null);
  const count = check?.items.length ?? 0;
  return (
    <BottomSheet open={check !== null} onOpenChange={(open) => (open ? undefined : onContinue())} label={check?.text ?? 'Check items again'} scrim={52} initialFocusRef={recountRef} className="gap-4 px-5 pb-6 pt-2.5">
      <SheetGrabber />
      <div className="flex flex-col gap-1">
        <h2 className="font-wds-sans text-[20px] font-semibold leading-[26px] text-wds-text-ink">{check?.text}</h2>
        <p className="font-wds-sans text-[13px] leading-[19px] text-wds-text-secondary">
          {count === 1 ? 'This one looks' : 'These look'} different from what the system expects. A second look takes a moment while you are at the shelf.
        </p>
      </div>
      <ul className="flex flex-col border-t border-wds-border">
        {check?.items.map((item) => (
          <li key={item.lineId} className="flex h-[52px] shrink-0 items-center justify-between border-b border-wds-border">
            <span className="flex flex-col">
              <span className="font-wds-sans text-[15px] font-semibold leading-5 text-wds-text-ink">{item.itemName}</span>
              <span className="font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
                you counted {item.counted} {item.unit}
              </span>
            </span>
            <span className="font-wds-sans text-[13px] font-medium leading-4 text-wds-selected-edge" aria-hidden>
              Recount
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <button ref={recountRef} type="button" onClick={onRecount} className={cn(PHONE_PRIMARY_BUTTON, 'h-12 text-[15px] leading-5')}>
          Recount {count} {count === 1 ? 'item' : 'items'}
        </button>
        <button type="button" onClick={onContinue} className={PHONE_SECONDARY_BUTTON}>
          Continue as counted
        </button>
      </div>
    </BottomSheet>
  );
}
