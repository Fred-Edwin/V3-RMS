'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { Topbar } from '@/components/app/shell/topbar';
import { Button } from '@/components/ui2/button';
import { cn } from '@/lib/cn';
import { usePurchasing } from '../../hooks/use-purchasing';
import type { Summary } from '../../types';
import { NeedsRestockingTab } from '../needs-restocking-tab';
import { OrdersTab } from '../orders-tab';
import { AwaitingInvoiceTab, ToPayTab } from '../orders-money-tabs';
import { AttendantPurchasingScreen } from './attendant-purchasing-screen';

type TabKey = 'needs' | 'approval' | 'receive' | 'invoice' | 'pay' | 'closed';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'needs', label: 'Needs restocking' },
  { key: 'approval', label: 'Awaiting approval' },
  { key: 'receive', label: 'To receive' },
  { key: 'invoice', label: 'Awaiting invoice' },
  { key: 'pay', label: 'To pay' },
  { key: 'closed', label: 'Closed' },
];

/**
 * Purchasing: one page, six stage tabs (Paper chapter 1, "01 · Needs restocking"). Each tab's body is its own component;
 * the page owns the header and the tabs with their counts.
 */
export function PurchasingScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (TABS.find((t) => t.key === params.get('tab'))?.key ?? 'needs') as TabKey;
  const { service, data, can, ready } = usePurchasing();
  const [summary, setSummary] = React.useState<Summary | null>(null);

  React.useEffect(() => {
    if (!ready) return;
    let live = true;
    service
      .getSummary()
      .then((s) => live && setSummary(s))
      .catch(() => live && setSummary(null));
    return () => {
      live = false;
    };
  }, [service, data, ready]);

  // Whoever raises requests but cannot approve them (the Store Attendant in the access table) gets Restock, To receive and My orders
  // (Paper chapter 9) instead of the six stage tabs. Decided from capabilities, never from a role name.
  if (ready && can('orders.request') && !can('orders.approve')) return <AttendantPurchasingScreen />;

  return (
    <>
      <Topbar
        breadcrumb={{ section: 'Central Store', screen: 'Purchasing', sectionHref: '/app/inventory/purchasing' }}
        hideSearch
        className="shrink-0"
        actions={
          <>
            {can('payables.record_payment') && tab !== 'pay' ? (
              <Button variant="secondary" asChild>
                <Link href="/app/inventory/purchasing?tab=pay">Pay supplier</Link>
              </Button>
            ) : null}
            {can('orders.request') ? (
              <Button asChild>
                <Link href="/app/inventory/purchasing/new">New order</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-wds-sans text-[24px] font-semibold leading-[30px] tracking-[-0.01em] text-wds-neutral-950">Purchasing</h1>
          <p className="font-wds-sans text-wds-body-sm text-wds-text-secondary">From what we need to what we&apos;ve paid, one order at a time.</p>
        </div>
        <div role="tablist" aria-label="Purchasing stages" className="flex items-end gap-7 border-b border-wds-border">
          {TABS.map((t) => {
            const active = t.key === tab;
            const count = summary?.counts[t.key];
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => router.replace(`/app/inventory/purchasing?tab=${t.key}`)}
                className={cn(
                  '-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 font-wds-sans text-wds-body-sm transition-colors focus-visible:outline-none focus-visible:shadow-wds-ring',
                  active ? 'border-wds-primary font-semibold text-wds-neutral-950' : 'border-transparent text-wds-text-secondary hover:text-wds-neutral-950'
                )}
              >
                {t.label}
                {count !== undefined && count > 0 ? <span className={cn('font-wds-mono text-wds-label', active ? 'text-wds-primary' : 'text-wds-text-muted')}>{count}</span> : null}
              </button>
            );
          })}
        </div>
        {tab === 'needs' ? <NeedsRestockingTab canOrder={can('orders.request')} /> : tab === 'invoice' ? <AwaitingInvoiceTab /> : tab === 'pay' ? <ToPayTab /> : <OrdersTab key={tab} tab={tab} />}
      </div>
    </>
  );
}
