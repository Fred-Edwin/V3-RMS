'use client';

import * as React from 'react';
import Link from 'next/link';

import { useRequisitionBadges } from '../../requisitions/hooks/use-requisition-badges';

/**
 * The Branch Manager's dashboard rows for Inventory (F13): a delivery waiting for a count, and an open shortage. They read the same
 * counts as the sidebar badges, so the two always agree. Draws nothing when neither is waiting; `onCountChange` tells the parent
 * "Needs your action" section whether it still has to show its empty state.
 */
export function BranchNeedsAction({ enabled, onCountChange }: { enabled: boolean; onCountChange?: (count: number) => void }) {
  const badges = useRequisitionBadges(enabled);
  const deliveries = badges?.deliveries ?? 0;
  const shortages = badges?.discrepancies ?? 0;
  const total = deliveries + shortages;
  React.useEffect(() => {
    onCountChange?.(total);
  }, [total, onCountChange]);
  if (total === 0) return null;
  const rows = [
    ...(deliveries > 0 ? [{ key: 'deliveries', href: '/app/branch/requisitions', title: `${deliveries} ${deliveries === 1 ? 'delivery is' : 'deliveries are'} waiting for a count`, hint: 'Open the Queue and look at To confirm.' }] : []),
    ...(shortages > 0 ? [{ key: 'shortages', href: '/app/branch/requisitions/discrepancies', title: `${shortages} open ${shortages === 1 ? 'shortage' : 'shortages'}`, hint: 'The Store Manager is looking. See what was counted.' }] : []),
  ];
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.key}>
          <Link href={row.href} className="flex flex-col gap-0.5 rounded-lg border border-warning-border bg-warning-bg px-4 py-3 hover:bg-white">
            <span className="text-body-sm font-semibold text-warning">{row.title}</span>
            <span className="text-caption text-stone-500">{row.hint}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
