'use client';

import * as React from 'react';

import { TwoLineRow } from '../../../_shared';

export interface SideItem {
  id: string;
  title: string;
  sub: string;
  status?: string;
  statusTone?: 'default' | 'warning' | 'success';
}

/**
 * The list on the left of the rota (Paper steps 1 and 8): departments for a Branch Manager or a head, sites for HR and the Director.
 * The chosen row carries the caramel bar. The note at the bottom says what saving means here.
 */
export function RotaSideList({
  caption,
  items,
  value,
  onChange,
  note,
}: {
  /** "DEPARTMENTS" or "SITES". */
  caption: string;
  items: readonly SideItem[];
  value: string;
  onChange: (id: string) => void;
  note: string;
}) {
  return (
    <nav aria-label={caption.toLowerCase()} className="flex min-h-[480px] w-full flex-col border-b border-wds-text-ink lg:w-[288px] lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-4 py-3.5">
        <span className="font-wds-mono text-[10px] leading-3 tracking-[0.06em] text-wds-text-secondary">{caption}</span>
        <span className="font-wds-mono text-[11px] leading-[14px] text-wds-text-secondary">{items.length}</span>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((i) => (
          <li key={i.id}>
            <TwoLineRow title={i.title} sub={i.sub} status={i.status} statusTone={i.statusTone} selected={i.id === value} onSelect={() => onChange(i.id)} />
          </li>
        ))}
      </ul>
      <p className="m-0 mt-auto border-t border-wds-border bg-wds-neutral-50 px-4 py-3.5 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">{note}</p>
    </nav>
  );
}
