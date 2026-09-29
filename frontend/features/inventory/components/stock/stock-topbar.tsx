'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/cn';
import { Button } from '@/components/ui2/button';
import { Topbar, type TopbarBreadcrumb } from '@/components/app/shell/topbar';
import { HintTooltip } from '@/components/app/shell/hint-tooltip';
import { COMING_WITH_COUNTING } from '../inventory-shell';

/**
 * A button that is drawn but not usable yet (decision 1: Session-2 features
 * render disabled with "Coming with counting") — drawn exactly as in Paper,
 * no dimming (owner decision), so the disabled state is carried by the
 * not-allowed cursor, the hint and `aria-disabled`. `aria-disabled`, not
 * `disabled`, so it stays focusable and the hint can show on hover and focus
 * (see `HintTooltip`); no press scale, no action.
 */
export function ComingSoonButton({
  children,
  hint = COMING_WITH_COUNTING,
  variant = 'secondary',
  className,
}: {
  children: React.ReactNode;
  hint?: string;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  return (
    <HintTooltip hint={hint}>
      {(describedBy) => (
        <Button
          type="button"
          variant={variant}
          aria-disabled="true"
          aria-describedby={describedBy}
          onClick={(e) => e.preventDefault()}
          className={cn('cursor-not-allowed motion-safe:active:scale-100', className)}
        >
          {children}
        </Button>
      )}
    </HintTooltip>
  );
}

export interface StockTopbarProps {
  /** Breadcrumb tail, e.g. "Stock & counts" or "Coffee beans · ledger". */
  screen: string;
  /** Links "Stock & counts" back to the hub when on a sub-page. */
  showHubCrumb?: boolean;
  onRestockLevels: () => void;
  onLogWaste: () => void;
  /** Refs so the drawers can hand focus back to their trigger on close (§4.2). */
  restockTriggerRef?: React.Ref<HTMLButtonElement>;
  wasteTriggerRef?: React.Ref<HTMLButtonElement>;
}

/**
 * Stock & counts top bar — Paper `1B18-0`: breadcrumb, item search, then
 * Thresholds · Restock levels · Log waste · Spot count. Thresholds and Spot
 * count are Session 2 (disabled with a hint). The search jumps to All items
 * filtered by the query on Enter; ⌘K / Ctrl+K focuses it (the hint Paper
 * draws), with no animation — it's a keyboard action.
 */
export function StockTopbar({
  screen,
  showHubCrumb = false,
  onRestockLevels,
  onLogWaste,
  restockTriggerRef,
  wasteTriggerRef,
}: StockTopbarProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const breadcrumb: TopbarBreadcrumb = showHubCrumb
    ? { root: 'Central Store', section: 'Stock & counts', screen, sectionHref: '/app/inventory/stock' }
    : { section: 'Central Store', screen };

  return (
    <Topbar
      className="shrink-0"
      breadcrumb={breadcrumb}
      searchRef={inputRef}
      searchProps={{
        value: query,
        placeholder: 'Search an item',
        'aria-label': 'Search an item',
        onChange: (e) => setQuery(e.target.value),
        onKeyDown: (e) => {
          if (e.key === 'Enter' && query.trim()) {
            router.push(`/app/inventory/stock/items?search=${encodeURIComponent(query.trim())}`);
          }
        },
      }}
      actions={
        <>
          <ComingSoonButton>Thresholds</ComingSoonButton>
          <Button ref={restockTriggerRef} variant="secondary" onClick={onRestockLevels}>
            Restock levels
          </Button>
          <Button ref={wasteTriggerRef} variant="secondary" onClick={onLogWaste}>
            Log waste
          </Button>
          <ComingSoonButton variant="primary">Spot count</ComingSoonButton>
        </>
      }
    />
  );
}
