import * as React from 'react';

import { cn } from '@/lib/cn';

import { HomeButton } from './home-button';
import { SectionHeader } from './section-header';

/**
 * "Needs your attention" (HR Home, Paper PME-0): one line per thing that waits on this person. An 8 px square in the kind's colour,
 * the title and a grey line, how long it has waited (mono, amber when it is late), and one button. Rows come in most urgent first.
 */
export type AttentionKind = 'request' | 'report' | 'setup' | 'date';

export interface AttentionItem {
  key: string;
  /** Colours the square: a request is blue, a late report amber, setup and dates caramel. */
  kind: AttentionKind;
  /** "Leave request · Faith Njeri". */
  title: string;
  detail: string;
  /** "1 DAY", "TODAY", "SET UP". */
  age: string;
  /** Turns the age amber. */
  late?: boolean;
  /** The one button. Left out when the person may not act: the row then has no button. */
  action?: { label: string; onClick: () => void };
}

const MARK: Record<AttentionKind, string> = {
  request: 'bg-wds-info-fg',
  report: 'bg-wds-warning-fg',
  setup: 'bg-wds-caramel-600',
  date: 'bg-wds-caramel-600',
};

export function AttentionList({
  title = 'Needs your attention',
  items,
  viewAll,
  className,
}: {
  title?: string;
  items: readonly AttentionItem[];
  viewAll?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn('flex min-w-0 flex-col', className)}>
      <SectionHeader title={title} link={viewAll} />
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((item) => (
          <li key={item.key} className="flex min-h-[60px] items-center gap-3.5 border-b border-wds-border py-2">
            <span aria-hidden className={cn('size-2 shrink-0', MARK[item.kind])} />
            <div className="flex min-w-0 grow basis-0 flex-col gap-0.5">
              <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{item.title}</span>
              <span className="font-wds-sans text-[13px] leading-4 text-wds-text-secondary">{item.detail}</span>
            </div>
            <span className={cn('w-14 shrink-0 font-wds-mono text-[11px] leading-[14px]', item.late ? 'text-wds-warning-fg' : 'text-wds-text-faint')}>{item.age}</span>
            {item.action ? (
              <HomeButton size="row" onClick={item.action.onClick} aria-label={`${item.action.label}: ${item.title}`}>
                {item.action.label}
              </HomeButton>
            ) : (
              <span aria-hidden className="w-[70px] shrink-0" />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
