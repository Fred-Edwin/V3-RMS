'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Search } from 'lucide-react';
import { Card, EmptyState, HelpTip, TabBar } from '@/components/ui';
import { PurchaseOrderStatusBadge } from '@/components/inventory/PurchaseOrderStatusBadge';
import { listPurchaseOrders } from '@/services/inventoryService';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { useIsDesktopShell } from '@/lib/shell-context';
import type { PurchaseOrder } from '@/types/inventory';
import { PurchaseOrdersDesktop } from './PurchaseOrdersDesktop';
import { SupplierInvoicesAP } from './SupplierInvoicesAP';

type PurchasesTab = 'orders' | 'invoices';

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' });

const orderTotal = (po: PurchaseOrder): number =>
  po.lines.reduce((sum, line) => sum + parseFloat(line.orderedQty) * parseFloat(line.unitPrice), 0);

export default function PurchaseOrdersPage(): JSX.Element {
  const role = useAuthStore((state) => state.role);
  if (role === 'STORE_MANAGER') {
    return <PurchaseOrdersManagerDispatch />;
  }
  return <PurchaseOrdersList isManager={false} />;
}

// STORE_MANAGER's dual shell mounts both the desktop sidebar copy and the
// CSS-hidden mobile copy simultaneously — see lib/shell-context.tsx.
function PurchaseOrdersManagerDispatch(): JSX.Element {
  const isDesktop = useIsDesktopShell();
  if (isDesktop) return <PurchaseOrdersDesktop />;
  return <PurchaseOrdersList isManager />;
}

// Manager mobile reuses the same card list + floating "New PO" action
// Session 6 built for Attendant (§8.1 row 5 mobile: "List of PO cards...
// step-by-step item picker") — only the "waiting for manager" DRAFT callout
// is Attendant-specific, since Manager IS the one who sends it.
function PurchaseOrdersList({ isManager }: { isManager: boolean }): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<PurchasesTab>('orders');
  const [hasInvoiceDetail, setHasInvoiceDetail] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await listPurchaseOrders(accessToken);
      setOrders(result);
    } catch (error) {
      toast({ variant: 'error', title: 'Failed to load purchase orders', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((po) => !q || po.poNumber.toLowerCase().includes(q) || po.supplier.name.toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, search]);

  return (
    <div className="min-h-full bg-crema pb-24">
      {!(isManager && activeTab === 'invoices' && hasInvoiceDetail) && (
        <>
          <div className="flex items-start justify-between gap-3 bg-espresso px-4 pb-5 pt-6 text-crema">
            <div>
              <p className="font-display text-heading-lg font-medium">{isManager ? 'Purchases' : 'Purchase Orders'}</p>
              <p className="text-label-md text-crema/70">{isManager ? 'Orders and supplier invoices' : 'Central Store'}</p>
            </div>
            <HelpTip
              title={isManager ? 'Purchases' : 'Purchase Orders'}
              triggerClassName="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-crema/70 transition-colors hover:bg-white/10 hover:text-crema focus-visible:outline-none focus-visible:shadow-focus"
            >
              {isManager ? (
                <>
                  <p>Order stock from your suppliers, and track what you owe them.</p>
                  <p className="mt-2">
                    Switch to the Invoices / AP tab to record supplier invoices and payments.
                  </p>
                </>
              ) : (
                <>
                  <p>Order stock from your suppliers. Pick items and quantities to create a draft.</p>
                  <p className="mt-2">
                    You can create a draft, but only a Manager can send it — it shows &ldquo;Waiting for manager to
                    send&rdquo; until they do.
                  </p>
                </>
              )}
            </HelpTip>
          </div>

          {isManager && (
            <TabBar
              tabs={[
                { value: 'orders', label: 'Purchase Orders' },
                { value: 'invoices', label: 'Invoices / AP' },
              ]}
              active={activeTab}
              onChange={setActiveTab}
              className="mx-4 mt-4"
            />
          )}
        </>
      )}

      {isManager && activeTab === 'invoices' ? (
        <SupplierInvoicesAP mode="mobile" onMobileDetailChange={setHasInvoiceDetail} />
      ) : (
        <>

      <div className="px-4 py-4">
        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by PO number or supplier…"
            className="h-11 w-full rounded-md border border-stone-200 bg-white pl-9 pr-3 text-body-md text-stone-900 placeholder:text-stone-400 focus:border-espresso focus:outline-none"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-md bg-stone-100" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            icon={<FileText size={40} />}
            heading={orders.length === 0 ? 'No purchase orders yet' : 'No orders match your search'}
            body={
              orders.length === 0
                ? isManager
                  ? 'Create a draft order to get started, then send it to the supplier.'
                  : 'Create a draft order to get started — your manager will send it to the supplier.'
                : 'Try a different search term.'
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((po) => (
              <Link key={po.id} href={`/app/inventory/purchase-orders/${po.id}`}>
                <Card className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-body-md font-semibold text-stone-900">{po.poNumber}</p>
                      <p className="truncate text-label-md text-stone-500">{po.supplier.name}</p>
                    </div>
                    <PurchaseOrderStatusBadge status={po.status} />
                  </div>

                  {po.status === 'DRAFT' && !isManager && (
                    <p className="mt-2 text-label-md font-medium text-warning">
                      Waiting for manager to send
                    </p>
                  )}
                  {po.status === 'DRAFT' && isManager && (
                    <p className="mt-2 text-label-md font-medium text-warning">
                      Draft — needs to be sent
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-between text-label-md text-stone-500">
                    <span>{formatDate(po.createdAt)}</span>
                    <span className="font-semibold text-stone-700">Ksh {orderTotal(po).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Floating new-PO action — thumb-reachable per §12.1 */}
      <Link
        href="/app/inventory/purchase-orders/new"
        className="fixed bottom-24 right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-amber px-5 text-label-lg font-semibold text-espresso shadow-lg"
      >
        <Plus size={20} />
        New Purchase Order
      </Link>
        </>
      )}
    </div>
  );
}
