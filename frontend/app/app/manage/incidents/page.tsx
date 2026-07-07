'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Badge, Button, EmptyState, ExcelTable, Input, PageHeader, PageLayout, Select, SkeletonTable, TabBar } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { incidentService, type Incident, type IncidentType } from '@/services/incidentService';
import { orderService, type BranchStaleOrder } from '@/services/orderService';
import { houseAccountService, type HouseAccountDropdownItem } from '@/services/houseAccountService';
import { useAuthStore } from '@/store/authStore';
import { useIncidentStore } from '@/store/incidentStore';
import { getSocket } from '@/lib/socket';
import { ApiError } from '@/types/api';

const INCIDENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'ORDER_CANCELLED', label: 'Order Cancelled' },
  { value: 'ORDER_ITEM_REMOVED', label: 'Order Item Removed' },
  { value: 'TICKET_REJECTED', label: 'Ticket Rejected' },
  { value: 'TICKET_UNCLAIMED', label: 'Ticket Unclaimed' },
  { value: 'ORDER_STALE', label: 'Order Stale' },
] as const;

const incidentTypeLabel: Record<IncidentType, string> = {
  ORDER_CANCELLED: 'Order Cancelled',
  ORDER_ITEM_REMOVED: 'Item Removed',
  TICKET_REJECTED: 'Ticket Rejected',
  MODIFICATION_REQUESTED: 'Mod Requested',
  MODIFICATION_APPROVED: 'Mod Approved',
  MODIFICATION_REJECTED: 'Mod Rejected',
  TICKET_UNCLAIMED: 'Ticket Unclaimed',
  ORDER_STALE: 'Order Stale',
};

const incidentTypeTone: Record<IncidentType, BadgeTone> = {
  ORDER_CANCELLED: 'danger',
  ORDER_ITEM_REMOVED: 'warning',
  TICKET_REJECTED: 'danger',
  MODIFICATION_REQUESTED: 'warning',
  MODIFICATION_APPROVED: 'success',
  MODIFICATION_REJECTED: 'warning',
  TICKET_UNCLAIMED: 'warning',
  ORDER_STALE: 'warning',
};

const toYmd = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const fmtShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' });

const fmtMoney = (value: string): string =>
  new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));

const formatDetails = (type: IncidentType, details: Record<string, unknown>): React.ReactNode => {
  if (type === 'ORDER_ITEM_REMOVED') {
    const removedItems = details.removedItems as Array<{ name: string; quantity: number }> | undefined;
    const parts: string[] = [];
    if (details.reason) parts.push(`Reason: ${String(details.reason)}`);
    if (removedItems && removedItems.length > 0) {
      parts.push(`Removed: ${removedItems.map((i) => (i.quantity > 1 ? `${i.name} ×${i.quantity}` : i.name)).join(', ')}`);
    }
    if (details.resultedInCancellation === true) parts.push('Order cancelled as a result');
    return parts.join(' · ') || JSON.stringify(details);
  }

  if (type === 'ORDER_STALE') {
    return (
      <div className="space-y-1.5">
        {Boolean(details.waiterName) && (
          <div className="flex items-center gap-2">
            <span className="text-caption font-medium text-stone-500 uppercase tracking-wide w-20 shrink-0">Waiter</span>
            <span className="font-semibold text-stone-900">{String(details.waiterName)}</span>
          </div>
        )}
        {Boolean(details.dailyNumber) && (
          <div className="flex items-center gap-2">
            <span className="text-caption font-medium text-stone-500 uppercase tracking-wide w-20 shrink-0">Order</span>
            <span className="text-stone-700">#{String(details.dailyNumber)}</span>
          </div>
        )}
        {Boolean(details.orderDate) && (
          <div className="flex items-center gap-2">
            <span className="text-caption font-medium text-stone-500 uppercase tracking-wide w-20 shrink-0">Date</span>
            <span className="text-stone-700">{String(details.orderDate)}</span>
          </div>
        )}
        {Boolean(details.status) && (
          <div className="flex items-center gap-2">
            <span className="text-caption font-medium text-stone-500 uppercase tracking-wide w-20 shrink-0">Status</span>
            <span className="text-stone-700">{String(details.status).replace('_', ' ')}</span>
          </div>
        )}
        {details.itemCount !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-caption font-medium text-stone-500 uppercase tracking-wide w-20 shrink-0">Items</span>
            <span className="text-stone-700">{String(details.itemCount)}</span>
          </div>
        )}
      </div>
    );
  }

  const parts: string[] = [];
  if (details.reason) parts.push(`Reason: ${String(details.reason)}`);
  if (details.description) parts.push(`Description: ${String(details.description)}`);
  if (details.reviewNote) parts.push(`Note: ${String(details.reviewNote)}`);
  if (details.dailyNumber) parts.push(`Order #${String(details.dailyNumber)}`);
  if (parts.length === 0) return JSON.stringify(details);
  return parts.join(' | ');
};

type TabId = 'incidents' | 'stale';

/* ── Resolve modal: one of force-ready / payment / house-account / cancel ── */
type ResolveMode = 'payment' | 'house' | 'cancel' | 'forceReady';

const CANCEL_REASONS = ['Customer walked out', 'Order placed by mistake', 'Duplicate order', 'Other'] as const;

function ResolveModal({
  order,
  mode,
  houseAccounts,
  onClose,
  onDone,
}: {
  order: BranchStaleOrder;
  mode: ResolveMode;
  houseAccounts: HouseAccountDropdownItem[];
  onClose: () => void;
  onDone: () => void;
}): JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // payment
  const [method, setMethod] = useState<'CASH' | 'MPESA' | 'CARD'>('CASH');
  const [mpesaCode, setMpesaCode] = useState('');
  // house account
  const [houseAccountId, setHouseAccountId] = useState('');
  // cancel / force-ready
  const [reason, setReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');

  const title: Record<ResolveMode, string> = {
    payment: 'Record Payment & Close',
    house: 'Send to House Account',
    cancel: 'Cancel Order',
    forceReady: 'Force Ready',
  };

  const run = async () => {
    if (!accessToken) return;
    setSubmitting(true);
    try {
      if (mode === 'forceReady') {
        if (reason.trim().length < 3) throw new Error('Please give a reason (min 3 characters).');
        await orderService.forceReady(order.id, reason.trim(), accessToken);
        toast({ variant: 'success', title: 'Order forced ready', message: 'You can now record payment to close it.' });
      } else if (mode === 'payment') {
        if (method === 'MPESA' && mpesaCode.trim().length < 4) throw new Error('Enter the M-Pesa code.');
        await orderService.recordPayment(
          order.id,
          { paymentMethod: method, ...(method === 'MPESA' ? { mpesaCode: mpesaCode.trim() } : {}) },
          accessToken,
        );
        toast({ variant: 'success', title: 'Payment recorded', message: `Order #${order.dailyNumber} closed.` });
      } else if (mode === 'house') {
        if (!houseAccountId) throw new Error('Choose a house account.');
        await orderService.recordPayment(order.id, { paymentMethod: 'HOUSE_ACCOUNT', houseAccountId } as never, accessToken);
        toast({ variant: 'success', title: 'Sent for approval', message: 'House-account authorization requested.' });
      } else {
        if (!reason) throw new Error('Choose a reason.');
        if (reason === 'Other' && reasonDetail.trim().length < 3) throw new Error('Add a short detail for "Other".');
        await orderService.cancel(order.id, { reason, reasonDetail: reasonDetail.trim() || undefined }, accessToken);
        toast({ variant: 'success', title: 'Order cancelled', message: `Order #${order.dailyNumber} cancelled.` });
      }
      onDone();
    } catch (err) {
      toast({ variant: 'error', title: 'Could not complete', message: err instanceof Error ? err.message : 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-bold text-stone-900">{title[mode]}</h3>
        <p className="mt-0.5 text-[12px] text-stone-500">
          Order #{order.dailyNumber} · {fmtShortDate(order.orderDate)} · Ksh {fmtMoney(order.total)} · {order.waiterName}
        </p>

        <div className="mt-4 space-y-3">
          {mode === 'payment' && (
            <>
              <Select
                label="Payment method"
                value={method}
                onChange={(e) => setMethod(e.target.value as 'CASH' | 'MPESA' | 'CARD')}
                options={[{ value: 'CASH', label: 'Cash' }, { value: 'MPESA', label: 'M-Pesa' }, { value: 'CARD', label: 'Card' }]}
              />
              {method === 'MPESA' && (
                <Input label="M-Pesa code" value={mpesaCode} onChange={(e) => setMpesaCode(e.target.value.toUpperCase())} placeholder="e.g. QGH7XK2P9L" />
              )}
            </>
          )}

          {mode === 'house' && (
            <Select
              label="House account"
              value={houseAccountId}
              onChange={(e) => setHouseAccountId(e.target.value)}
              options={[{ value: '', label: 'Select account…' }, ...houseAccounts.map((h) => ({ value: h.id, label: h.userName }))]}
            />
          )}

          {mode === 'forceReady' && (
            <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why force this order ready?" />
          )}

          {mode === 'cancel' && (
            <>
              <Select
                label="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                options={[{ value: '', label: 'Select reason…' }, ...CANCEL_REASONS.map((r) => ({ value: r, label: r }))]}
              />
              {reason === 'Other' && (
                <Input label="Detail" value={reasonDetail} onChange={(e) => setReasonDetail(e.target.value)} placeholder="Short explanation" />
              )}
            </>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button size="sm" onClick={() => void run()} isLoading={submitting}>Confirm</Button>
        </div>
      </div>
    </div>
  );
}

export default function IncidentsPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const resetUnread = useIncidentStore((state) => state.resetUnread);

  const [activeTab, setActiveTab] = useState<TabId>('incidents');

  // ── Incidents tab state (unchanged) ──
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState(toYmd(new Date()));
  const [endDate, setEndDate] = useState(toYmd(new Date()));
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Stale Orders tab state ──
  const [staleOrders, setStaleOrders] = useState<BranchStaleOrder[]>([]);
  const [staleTotal, setStaleTotal] = useState('0.00');
  const [isLoadingStale, setIsLoadingStale] = useState(false);
  const [houseAccounts, setHouseAccounts] = useState<HouseAccountDropdownItem[]>([]);
  const [resolveTarget, setResolveTarget] = useState<{ order: BranchStaleOrder; mode: ResolveMode } | null>(null);

  useEffect(() => {
    resetUnread();
  }, [resetUnread]);

  const loadIncidents = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await incidentService.getMany(
        {
          type: typeFilter ? (typeFilter as IncidentType) : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page,
          perPage: 20,
        },
        accessToken,
      );
      setIncidents(result.incidents);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load incidents';
      toast({ variant: 'error', title: 'Error', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, typeFilter, startDate, endDate, page, toast]);

  useEffect(() => {
    if (activeTab === 'incidents') void loadIncidents();
  }, [activeTab, loadIncidents]);

  const loadStaleOrders = useCallback(async () => {
    if (!accessToken) return;
    setIsLoadingStale(true);
    try {
      const result = await orderService.getBranchStaleOrders(accessToken);
      setStaleOrders(result.orders);
      setStaleTotal(result.totalLiability);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load stale orders';
      toast({ variant: 'error', title: 'Error', message });
    } finally {
      setIsLoadingStale(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    if (activeTab === 'stale') void loadStaleOrders();
  }, [activeTab, loadStaleOrders]);

  // House accounts loaded once for the "send to house account" action
  useEffect(() => {
    if (!accessToken || activeTab !== 'stale') return;
    void houseAccountService.listActive(accessToken).then(setHouseAccounts).catch(() => { /* non-critical */ });
  }, [accessToken, activeTab]);

  // Real-time: prepend new incidents
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewIncident = (payload: {
      id: string;
      type: string;
      orderId?: string;
      actor: { id: string; name: string } | null;
      details: Record<string, unknown>;
      createdAt: string;
    }) => {
      const incident: Incident = {
        ...payload,
        type: payload.type as IncidentType,
        organizationId: '',
        branchName: '',
        orderId: payload.orderId ?? null,
      };
      setIncidents((prev) => [incident, ...prev]);
    };

    socket.on('incident:new', handleNewIncident);
    return () => {
      socket.off('incident:new', handleNewIncident);
    };
  }, []);

  const hasStale = staleOrders.length > 0;
  const staleCount = staleOrders.length;

  const tabs = useMemo(
    () => [
      { value: 'incidents' as TabId, label: 'Incidents' },
      { value: 'stale' as TabId, label: staleCount > 0 ? `Stale Orders (${staleCount})` : 'Stale Orders' },
    ],
    [staleCount],
  );

  return (
    <PageLayout className="space-y-4">
      <PageHeader title="Incidents" subtitle="Non-happy-path events and unresolved orders across your branch" />

      {/* Tabs */}
      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} variant="underline" />

      {/* ── INCIDENTS TAB ── */}
      {activeTab === 'incidents' && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <Select
                label="Type"
                options={INCIDENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              />
            </div>
            <div className="w-40">
              <Input label="From" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
            </div>
            <div className="w-40">
              <Input label="To" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
            </div>
          </div>

          {isLoading ? (
            <SkeletonTable rows={6} columns={4} />
          ) : incidents.length === 0 ? (
            <EmptyState icon={<AlertTriangle size={40} />} heading="No incidents" body="No incidents match your filters." />
          ) : (
            <div className="space-y-2">
              <ExcelTable
                columns={[
                  {
                    key: 'type',
                    label: 'Type',
                    render: (incident) => <Badge tone={incidentTypeTone[incident.type]}>{incidentTypeLabel[incident.type]}</Badge>,
                  },
                  {
                    key: 'actor',
                    label: 'Actor',
                    render: (incident) => (
                      <>
                        {incident.actor?.name ?? 'System'}
                        {incident.type === 'ORDER_STALE' && Boolean(incident.details.dailyNumber) && (
                          <span className="ml-1.5 text-caption text-stone-400">Order #{String(incident.details.dailyNumber)}</span>
                        )}
                      </>
                    ),
                  },
                  {
                    key: 'createdAt',
                    label: 'Time',
                    render: (incident) => <span className="whitespace-nowrap text-stone-500">{formatTimestamp(incident.createdAt)}</span>,
                  },
                ]}
                rows={incidents}
                rowKey={(incident) => incident.id}
                headerTone="gray"
                expandable={{
                  isExpanded: (incident) => expandedId === incident.id,
                  onToggle: (incident) => setExpandedId(expandedId === incident.id ? null : incident.id),
                  childRows: (incident) => [{ actor: formatDetails(incident.type, incident.details) }],
                }}
              />

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span className="text-body-sm text-stone-500">Page {page} of {totalPages}</span>
                  <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── STALE ORDERS TAB ── */}
      {activeTab === 'stale' && (
        <>
          <p className="text-[12px] leading-snug text-stone-500 max-w-3xl">
            Unpaid orders left open from a previous day. Resolve each one — record payment to close it,
            force it ready first if it&rsquo;s stuck, send it to a house account, or cancel it. Resolved
            orders drop off this list and stop counting against the waiter.
          </p>

          {isLoadingStale ? (
            <div className="rounded-md border border-stone-200 bg-white p-5"><SkeletonTable rows={6} columns={5} /></div>
          ) : !hasStale ? (
            <div className="rounded-md border border-stone-200 bg-white p-12 text-center">
              <p className="text-[13px] font-semibold text-stone-700">No stale orders</p>
              <p className="mt-1 text-[12px] text-stone-400">Every order in your branch has been closed, cancelled, or accounted for.</p>
            </div>
          ) : (
            <ExcelTable
              columns={[
                { key: 'order', label: 'Order', render: (o) => <span className="font-semibold text-office-ink">#{o.dailyNumber}</span> },
                { key: 'waiter', label: 'Waiter', render: (o) => o.waiterName },
                {
                  key: 'dateTable',
                  label: 'Date / Table',
                  align: 'center',
                  render: (o) => (
                    <span className="whitespace-nowrap">
                      {fmtShortDate(o.orderDate)}{o.tableNumber ? ` · T${o.tableNumber}` : ''}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  align: 'center',
                  render: (o) => <span className="whitespace-nowrap">{o.status.replace(/_/g, ' ').toLowerCase()}</span>,
                },
                {
                  key: 'amount',
                  label: 'Amount (Ksh)',
                  numeric: true,
                  render: (o) => <span className="font-bold text-danger">{fmtMoney(o.total)}</span>,
                },
                {
                  key: 'resolve',
                  label: 'Resolve',
                  align: 'center',
                  render: (o) => {
                    const notReady = o.status !== 'READY';
                    return (
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        {notReady && (
                          <button
                            onClick={() => setResolveTarget({ order: o, mode: 'forceReady' })}
                            className="rounded border border-stone-300 bg-white px-2 py-0.5 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
                            title="Force the order ready so it can be closed"
                          >
                            Force Ready
                          </button>
                        )}
                        <button
                          onClick={() => setResolveTarget({ order: o, mode: 'payment' })}
                          disabled={notReady}
                          className="rounded border border-success-border bg-success-bg px-2 py-0.5 text-[11px] font-medium text-success hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={notReady ? 'Force ready first' : 'Record payment and close'}
                        >
                          Pay/Close
                        </button>
                        <button
                          onClick={() => setResolveTarget({ order: o, mode: 'house' })}
                          disabled={notReady}
                          className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={notReady ? 'Force ready first' : 'Send to a house account for approval'}
                        >
                          House Acct
                        </button>
                        <button
                          onClick={() => setResolveTarget({ order: o, mode: 'cancel' })}
                          className="rounded border border-danger-border bg-danger-bg px-2 py-0.5 text-[11px] font-medium text-danger hover:opacity-80"
                          title="Cancel the order"
                        >
                          Cancel
                        </button>
                      </div>
                    );
                  },
                },
              ]}
              rows={staleOrders}
              rowKey={(o) => o.id}
              numbered
              headerTone="navy"
              totalsRow={{
                order: <span className="text-label-sm uppercase tracking-wide">Total ({staleCount} order{staleCount > 1 ? 's' : ''})</span>,
                amount: <span className="font-bold text-danger">Ksh {fmtMoney(staleTotal)}</span>,
              }}
            />
          )}
        </>
      )}

      {resolveTarget && (
        <ResolveModal
          order={resolveTarget.order}
          mode={resolveTarget.mode}
          houseAccounts={houseAccounts}
          onClose={() => setResolveTarget(null)}
          onDone={() => { setResolveTarget(null); void loadStaleOrders(); }}
        />
      )}
    </PageLayout>
  );
}
