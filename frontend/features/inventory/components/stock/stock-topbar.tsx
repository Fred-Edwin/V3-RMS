'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui2/button';
import { Topbar, type TopbarBreadcrumb } from '@/components/app/shell/topbar';
import { ThresholdsDrawer } from './thresholds-drawer';

export interface StockTopbarProps {
  /** Breadcrumb tail, e.g. "Stock & counts" or "Coffee beans · ledger". */
  screen: string;
  /** Links "Stock & counts" back to the hub when on a sub-page. */
  showHubCrumb?: boolean;
  onRestockLevels: () => void;
  onLogWaste: () => void;
  /** Refs so the drawers can hand focus back to their trigger on close (§4.2). */
  thresholdsTriggerRef?: React.Ref<HTMLButtonElement>;
  restockTriggerRef?: React.Ref<HTMLButtonElement>;
  wasteTriggerRef?: React.Ref<HTMLButtonElement>;
}

/**
 * Stock & counts top bar — Paper `1B18-0`: breadcrumb, item search, then
 * Thresholds · Restock levels · Log waste · Spot count. The search jumps to All items
 * filtered by the query on Enter; ⌘K / Ctrl+K focuses it (the hint Paper
 * draws), with no animation — it's a keyboard action.
 */
export function StockTopbar({
  screen,
  showHubCrumb = false,
  onRestockLevels,
  onLogWaste,
  thresholdsTriggerRef,
  restockTriggerRef,
  wasteTriggerRef,
}: StockTopbarProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [thresholdsOpen, setThresholdsOpen] = React.useState(false);

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
    <>
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
          <Button ref={thresholdsTriggerRef} variant="secondary" onClick={() => setThresholdsOpen(true)}>
            Thresholds
          </Button>
          <Button ref={restockTriggerRef} variant="secondary" onClick={onRestockLevels}>
            Restock levels
          </Button>
          <Button ref={wasteTriggerRef} variant="secondary" onClick={onLogWaste}>
            Log waste
          </Button>
          <Button asChild>
            <Link href="/app/inventory/stock/spot-count">Spot count</Link>
          </Button>
        </>
      }
    />
    <ThresholdsDrawer open={thresholdsOpen} onOpenChange={setThresholdsOpen} variant="desktop" />
    </>
  );
}
