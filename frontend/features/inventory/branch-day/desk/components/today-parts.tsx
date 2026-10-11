'use client';

import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Chip, RefLink } from '../../../_shared/components/block2-phone-parts';
import { BRANCH_DAY_BUTTONS, blockerCopy, openingChip } from '../../_shared/lib/branch-day-copy';
import type { Blocker, DepartmentTile } from '../../_shared/types/branch-day-contract';
import { clock12, kes } from '../lib/desk-format';
import { BlockDisc, CheckDisc, HeadsUpRing, MonoLabel, PRESS } from './day-parts';

/** One department's card on Today (Paper B5, B7, B14, B16): name and head, state chip, Used today (cap), when, the exceptions slot, the link. */
export function DepartmentCard({ tile, showMoney, figuresHref }: { tile: DepartmentTile; showMoney: boolean; figuresHref: string }) {
  const counted = tile.state === 'COUNTED';
  const exception = counted ? openingChip(tile.opening.state, tile.opening.differences) : null;
  return (
    <li
      aria-label={tile.name}
      className={cn('flex min-w-0 flex-col gap-2.5 border bg-wds-surface p-4', counted ? 'border-wds-border-strong' : 'border-dashed border-[#8D8982]')}
    >
      <div className="flex flex-col gap-px">
        <h3 className="m-0 font-wds-sans text-[16px] font-semibold leading-5 text-wds-text-ink">{tile.name}</h3>
        <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">{tile.head?.name ?? 'No head set'}</span>
      </div>
      {counted ? (
        <Chip spec={{ text: 'Counted', tone: 'success', dot: true }} dotShape="square" className="self-start" />
      ) : (
        <Chip spec={{ text: 'Not counted', tone: 'muted', dot: true }} dotShape="square" ring className="self-start" />
      )}
      {showMoney ? (
        <div className="flex flex-col gap-0.5 border-t border-wds-border pt-3">
          <MonoLabel>Used today (KES)</MonoLabel>
          <span className={cn('font-wds-mono text-[20px] leading-[26px]', counted ? 'text-wds-text-ink' : 'text-[#8D8982]')}>{counted ? kes(tile.usedValueKes ?? null) : '–'}</span>
        </div>
      ) : null}
      <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
        {counted ? `Counted ${tile.countedAt ? clock12(tile.countedAt) : ''}` : 'Waiting for the count'}
      </span>
      <div className="flex h-[22px] items-center">
        {exception ? (
          <Chip spec={{ text: exception, tone: 'warning' }} className="max-w-full truncate" />
        ) : counted && tile.onBehalf ? (
          <Chip spec={{ text: 'By the Branch Manager', tone: 'neutral' }} className="max-w-full truncate" />
        ) : null}
      </div>
      {counted ? (
        <Link href={figuresHref} className={cn(PRESS, 'self-start font-wds-sans text-[13px] font-medium leading-[18px] text-wds-text-ink outline-none focus-visible:shadow-wds-ring [@media(hover:hover)]:hover:underline')}>
          {BRANCH_DAY_BUTTONS.openFigures} <span aria-hidden="true">→</span>
          <span className="sr-only"> for {tile.name}</span>
        </Link>
      ) : (
        <span className="font-wds-sans text-[13px] font-medium leading-[18px] text-[#8D8982]">No figures yet</span>
      )}
    </li>
  );
}

/** The icon and fill of a blocker row by severity: red blocks, green is fine, amber is a heads-up. */
function RowIcon({ blocker }: { blocker: Blocker }) {
  if (blocker.severity === 'BLOCKS') return <BlockDisc className="mt-px" />;
  if (blocker.severity === 'OK') return <CheckDisc className="mt-px" />;
  return <HeadsUpRing className="mt-px" />;
}

export interface BlockerActions {
  /** Opens B15 for this department (Branch Manager). */
  countFor?: (department: { id: string; name: string }) => void;
  /** Opens Block 2's confirm drawer for this dispatch (Branch Manager, System Admin). */
  confirmFor?: (blocker: Blocker) => void;
}

/**
 * The list under "Before the day can close" / "Ready to close" (B5, B7, B14). Facts come from the server; the words from the wording table.
 * A blocking row carries its action as a secondary button (gaps G21 and G22), only for who may use it; discrepancy references are links.
 */
export function BlockerRows({ blockers, departmentCount, actions, discrepancyHref, rowIds }: { blockers: readonly Blocker[]; departmentCount: number; actions: BlockerActions; discrepancyHref: (id: string) => string; rowIds?: boolean }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {blockers.map((blocker, index) => {
        const copy = blockerCopy(blocker, clock12, departmentCount);
        const blocks = blocker.severity === 'BLOCKS';
        const department = blocker.department;
        return (
          <li
            key={`${blocker.kind}-${department?.id ?? index}`}
            id={rowIds && blocks ? `blocker-${index}` : undefined}
            className={cn('flex items-start gap-3.5 border-b px-2 py-3.5', blocks ? 'border-wds-error-border bg-wds-error-bg' : 'border-wds-border')}
          >
            <RowIcon blocker={blocker} />
            <div className="flex min-w-0 grow flex-col gap-0.5">
              <span className="font-wds-sans text-[14px] font-medium leading-[18px] text-wds-text-ink">{copy.title}</span>
              <span className="font-wds-sans text-[13px] leading-[18px] text-wds-text-secondary">
                {copy.line}
                {blocker.discrepancies.length > 0 ? (
                  <>
                    {' '}
                    {blocker.discrepancies.map((d, i) => (
                      <React.Fragment key={d.id}>
                        {i > 0 ? ', ' : null}
                        <RefLink reference={d.reference} href={discrepancyHref(d.id)} />
                      </React.Fragment>
                    ))}
                  </>
                ) : null}
              </span>
            </div>
            {blocker.kind === 'DEPARTMENT_NOT_COUNTED' && department && actions.countFor ? (
              <Button variant="secondary" className="shrink-0 bg-white" onClick={() => actions.countFor?.(department)}>
                Count for {department.name}
                <span className="sr-only">, on behalf of the department</span>
              </Button>
            ) : null}
            {blocker.kind === 'DELIVERY_NOT_CONFIRMED' && department && actions.confirmFor ? (
              <Button variant="secondary" className="shrink-0 bg-white" onClick={() => actions.confirmFor?.(blocker)}>
                {BRANCH_DAY_BUTTONS.confirmFor(department.name)}
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
