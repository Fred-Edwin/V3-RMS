'use client';

import * as React from 'react';

import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui2/dropdown-menu';
import { cn } from '@/lib/cn';
import { AREA_MENU, areaButtonLabel, type AreaMenuItem } from '../lib/audit-log-logic';

type AreaValue = AreaMenuItem['value'];

/**
 * The Area menu (Paper step 58): "All areas" at the top, then the Central Store areas, then the Branches areas under their own
 * headings. The five Branches areas are listed now and answer nothing until each block adds its source. Picking the current area
 * again goes back to all areas.
 */
export function AreaMenu({ value, onSelect }: { value: AreaValue | null; onSelect: (value: AreaValue | null) => void }) {
  const item = 'min-h-8 px-3 font-wds-sans text-[13px] leading-4 max-sm:min-h-11';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-wds-sm border px-3 font-wds-sans text-[13px] leading-4 transition-colors focus-visible:outline-none focus-visible:shadow-wds-ring max-sm:h-11',
            value === null ? 'border-wds-border-strong bg-white text-wds-text-ink hover:bg-wds-neutral-50' : 'border-wds-text-ink bg-wds-text-ink font-medium text-white',
          )}
        >
          Area: {areaButtonLabel(value)} <span aria-hidden className="ml-1.5 text-[9px]">▾</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[300px] rounded-none border-wds-border-strong p-0 pb-1">
        <DropdownMenuItem onSelect={() => onSelect(null)} className={cn(item, 'rounded-none font-semibold')} aria-current={value === null ? 'true' : undefined}>
          All areas
        </DropdownMenuItem>
        {AREA_MENU.map((group) => (
          <DropdownMenuGroup key={group.heading}>
            <DropdownMenuLabel className="px-3 pb-0.5 pt-2.5 font-wds-mono text-[10px] font-normal uppercase leading-3 tracking-[0.06em] text-wds-text-secondary">{group.heading}</DropdownMenuLabel>
            {group.items.map((entry) => (
              <DropdownMenuItem
                key={entry.value}
                onSelect={() => onSelect(entry.value === value ? null : entry.value)}
                aria-current={entry.value === value ? 'true' : undefined}
                className={cn(item, 'rounded-none', entry.value === value && 'bg-wds-espresso-50 font-medium')}
              >
                {entry.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
