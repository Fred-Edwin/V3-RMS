'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { Button, PageHeader, PageLayout, Select, SkeletonBlock } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { orderService } from '@/services/orderService';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { OrderDetail } from '@/types/order';
import type { AccountantReconciliationReport } from '@/types/report';

// ── Helpers ────────────────────────────────────────────────────────────────────

const toYmd = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const yesterday = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toYmd(d);
};

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return 'KES 0.00';
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatTime = (isoString: string): string => {
  return new Date(isoString).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const PAYMENT_LABELS: Record<string, string> = {
  MPESA: 'M-Pesa',
  CASH: 'Cash',
  CARD: 'Card',
  SPLIT: 'Split',
  HOUSE_ACCOUNT: 'House Acct',
  CORPORATE_ACCOUNT: 'Corporate',
  CUSTOMER_CREDIT: 'Credit',
  UNKNOWN: '—',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function SummaryStatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'green' | 'blue' | 'amber' | 'red';
}) {
  const bg =
    accent === 'green'
      ? 'bg-[#EDFAF1] border-[#86EFAC]'
      : accent === 'blue'
        ? 'bg-[#EFF6FF] border-blue-200'
        : accent === 'amber'
          ? 'bg-[#FDF3DC] border-[#F0D080]'
          : accent === 'red'
            ? 'bg-[#FEF2F2] border-[#FCA5A5]'
            : 'bg-parchment border-stone-200';
  const text =
    accent === 'green'
      ? 'text-[#1A6B3C]'
      : accent === 'blue'
        ? 'text-[#1D4ED8]'
        : accent === 'amber'
          ? 'text-[#92650A]'
          : accent === 'red'
            ? 'text-[#991B1B]'
            : 'text-stone-700';

  return (
    <div className={`rounded-xl border px-4 py-4 ${bg}`}>
      <p className={`text-label-sm font-medium uppercase tracking-wider ${text} opacity-80`}>{label}</p>
      <p className={`mt-1 font-display text-display-lg font-semibold leading-tight ${text}`}>{value}</p>
    </div>
  );
}

type PaymentTab = 'ALL' | 'MPESA' | 'CASH' | 'CARD' | 'CREDIT';

function OrderDrillDown({
  report,
  accessToken,
  organizationId,
  date,
}: {
  report: AccountantReconciliationReport;
  accessToken: string;
  organizationId: string;
  date: string;
}) {
  const [activeTab, setActiveTab] = useState<PaymentTab>('ALL');
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>('ALL');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  // Cache fetched order details so re-expanding doesn't re-fetch
  const detailCache = useRef<Map<string, OrderDetail>>(new Map());
  const [expandedDetail, setExpandedDetail] = useState<OrderDetail | null>(null);
  const { toast } = useToast();

  const tabs: { key: PaymentTab; label: string }[] = [
    { key: 'ALL', label: 'All Orders' },
    { key: 'MPESA', label: 'M-Pesa' },
    { key: 'CASH', label: 'Cash' },
    { key: 'CARD', label: 'Card' },
    { key: 'CREDIT', label: 'Credit' },
  ];

  const waiterOptions = useMemo(() => [
    { value: 'ALL', label: 'All Waiters' },
    ...report.waiters.map((w) => ({ value: w.id, label: w.name })),
  ], [report.waiters]);

  const filteredOrders = useMemo(() => {
    let result = report.orders;
    if (selectedWaiterId !== 'ALL') {
      result = result.filter((o) => o.waiterId === selectedWaiterId);
    }
    if (activeTab === 'ALL') return result;
    if (activeTab === 'CREDIT') {
      return result.filter((o) =>
        ['HOUSE_ACCOUNT', 'CORPORATE_ACCOUNT', 'CUSTOMER_CREDIT'].includes(o.paymentMethod),
      );
    }
    return result.filter((o) => o.paymentMethod === activeTab);
  }, [activeTab, selectedWaiterId, report.orders]);

  const tabTotal = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + Number.parseFloat(o.total), 0);
  }, [filteredOrders]);

  const handleRowClick = useCallback(async (orderId: string): Promise<void> => {
    // Collapse if already expanded
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
      setExpandedDetail(null);
      return;
    }
    // Use cache if available
    const cached = detailCache.current.get(orderId);
    if (cached) {
      setExpandedOrderId(orderId);
      setExpandedDetail(cached);
      return;
    }
    setLoadingOrderId(orderId);
    try {
      const detail = await orderService.getById(orderId, accessToken, organizationId);
      detailCache.current.set(orderId, detail);
      setExpandedOrderId(orderId);
      setExpandedDetail(detail);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to load order details.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setLoadingOrderId(null);
    }
  // expandedOrderId intentionally omitted — we read it via closure but don't want re-creation on every expand
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, organizationId, toast]);

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const exportPdf = useCallback(async () => {
    setIsExportingPdf(true);
    try {
      await reportService.exportReport(accessToken, {
        reportType: 'accountant_reconciliation',
        format: 'pdf',
        startDate: date,
        endDate: date,
        organizationId,
      });
      toast({ variant: 'success', title: 'PDF download started' });
    } catch {
      toast({ variant: 'error', title: 'Export failed', message: 'Could not generate PDF report.' });
    } finally {
      setIsExportingPdf(false);
    }
  }, [accessToken, date, organizationId, toast]);

  const exportCsv = () => {
    const headers = ['Order #', 'Time', 'Waiter', 'Payment Method', 'Amount', 'M-Pesa Code'];
    const rows = filteredOrders.map((o) => [
      String(o.dailyNumber),
      formatTime(o.time),
      o.waiterName,
      PAYMENT_LABELS[o.paymentMethod] ?? o.paymentMethod,
      o.total,
      o.mpesaCode ?? '',
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const waiterSlug = selectedWaiterId !== 'ALL'
      ? `-${(report.waiters.find((w) => w.id === selectedWaiterId)?.name ?? '').replace(/\s+/g, '-').toLowerCase()}`
      : '';
    a.download = `reconciliation-${report.organizationName}-${report.date}${waiterSlug}-${activeTab.toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
        <div>
          <h3 className="text-heading-sm font-semibold text-stone-900">Order Detail</h3>
          <p className="mt-0.5 text-caption text-stone-400">Click any row to see its items</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={exportCsv}
            className="flex items-center gap-1.5 text-stone-500"
          >
            <Download size={14} />
            CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void exportPdf()}
            isLoading={isExportingPdf}
            className="flex items-center gap-1.5 text-stone-500"
          >
            <FileText size={14} />
            PDF
          </Button>
        </div>
      </div>

      {/* Waiter filter */}
      {report.waiters.length > 1 && (
        <div className="border-b border-stone-100 px-5 py-3">
          <select
            value={selectedWaiterId}
            onChange={(e) => setSelectedWaiterId(e.target.value)}
            className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-body-sm text-stone-700 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            {waiterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-100 px-5 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-label-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-espresso text-white'
                : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredOrders.length === 0 ? (
        <p className="px-5 py-8 text-center text-body-sm text-stone-400">
          No {activeTab === 'ALL' ? '' : PAYMENT_LABELS[activeTab]} orders for this date.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/60">
                <th className="w-8 px-3 py-2.5" />
                <th className="px-4 py-2.5 text-left text-label-sm font-medium text-stone-500">#</th>
                <th className="px-4 py-2.5 text-left text-label-sm font-medium text-stone-500">Time</th>
                <th className="px-4 py-2.5 text-left text-label-sm font-medium text-stone-500">Waiter</th>
                <th className="px-4 py-2.5 text-left text-label-sm font-medium text-stone-500">Method</th>
                <th className="px-4 py-2.5 text-left text-label-sm font-medium text-stone-500">Code</th>
                <th className="px-5 py-2.5 text-right text-label-sm font-medium text-stone-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const isLoading = loadingOrderId === order.id;
                return (
                  <>
                    <tr
                      key={order.id}
                      onClick={() => void handleRowClick(order.id)}
                      className={`cursor-pointer transition-colors ${isExpanded ? 'bg-amber-50/60' : 'hover:bg-stone-50/60'}`}
                    >
                      <td className="px-3 py-3 text-stone-400">
                        {isLoading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isExpanded ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-body-sm font-medium text-stone-700">#{order.dailyNumber}</td>
                      <td className="px-4 py-3 text-body-sm text-stone-600">{formatTime(order.time)}</td>
                      <td className="px-4 py-3 text-body-sm text-stone-700">{order.waiterName}</td>
                      <td className="px-4 py-3">
                        <span className="text-body-sm text-stone-700">
                          {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-body-sm text-stone-500">
                        {order.mpesaCode ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-body-sm font-semibold tabular-nums text-stone-900">
                        {formatCurrency(order.total)}
                      </td>
                    </tr>
                    {isExpanded && expandedDetail && (
                      <tr key={`${order.id}-detail`} className="bg-amber-50/30">
                        <td colSpan={7} className="px-6 pb-4 pt-2">
                          <div className="rounded-lg border border-amber-100 bg-white shadow-sm">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-stone-100">
                                  <th className="px-4 py-2 text-left text-label-sm font-medium text-stone-500">Item</th>
                                  <th className="px-4 py-2 text-center text-label-sm font-medium text-stone-500">Qty</th>
                                  <th className="px-4 py-2 text-right text-label-sm font-medium text-stone-500">Unit Price</th>
                                  <th className="px-4 py-2 text-right text-label-sm font-medium text-stone-500">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-50">
                                {expandedDetail.items.map((item) => (
                                  <tr key={item.id}>
                                    <td className="px-4 py-2.5 text-body-sm text-stone-700">
                                      {item.name}
                                      {item.notes && (
                                        <span className="ml-1.5 text-caption text-stone-400">({item.notes})</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-center text-body-sm text-stone-600">{item.quantity}</td>
                                    <td className="px-4 py-2.5 text-right font-mono text-body-sm text-stone-500">
                                      {formatCurrency(item.unitPrice)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-mono text-body-sm font-medium text-stone-700">
                                      {formatCurrency(item.subtotal)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                {expandedDetail.discountAmount && Number.parseFloat(expandedDetail.discountAmount) > 0 && (
                                  <tr className="border-t border-stone-100">
                                    <td colSpan={3} className="px-4 py-2 text-right text-label-sm text-stone-500">
                                      Subtotal
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-label-sm text-stone-500">
                                      {formatCurrency(expandedDetail.subtotal)}
                                    </td>
                                  </tr>
                                )}
                                {expandedDetail.discountAmount && Number.parseFloat(expandedDetail.discountAmount) > 0 && (
                                  <tr>
                                    <td colSpan={3} className="px-4 py-2 text-right text-label-sm text-[#1A6B3C]">
                                      Discount ({expandedDetail.discountPercent}%)
                                    </td>
                                    <td className="px-4 py-2 text-right font-mono text-label-sm text-[#1A6B3C]">
                                      -{formatCurrency(expandedDetail.discountAmount)}
                                    </td>
                                  </tr>
                                )}
                                <tr className="border-t-2 border-stone-200">
                                  <td colSpan={3} className="px-4 py-2.5 text-right text-label-sm font-semibold text-stone-700">
                                    Total
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-mono text-label-sm font-bold text-espresso">
                                    {formatCurrency(expandedDetail.total)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-200 bg-stone-50">
                <td colSpan={6} className="px-5 py-3 text-label-sm font-semibold text-stone-700">
                  {filteredOrders.length} orders
                </td>
                <td className="px-5 py-3 text-right font-mono text-label-sm font-bold tabular-nums text-espresso">
                  {formatCurrency(tabTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ReconciliationPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedDate, setSelectedDate] = useState(yesterday());
  const [report, setReport] = useState<AccountantReconciliationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [drillDownOpen, setDrillDownOpen] = useState(false);

  // Load branches on mount
  useEffect(() => {
    if (!accessToken) return;
    branchService
      .listBranches(accessToken)
      .then((data) => {
        const active = data.filter((b) => b.isActive && !b.isHub);
        setBranches(active);
        setSelectedBranchId(active[0]?.id ?? '');
      })
      .catch(() => {
        toast({ variant: 'error', title: 'Failed to load branches', message: 'Could not fetch branch list.' });
      });
  // accessToken is stable; toast is stable via useCallback in hook
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const load = useCallback(async (): Promise<void> => {
    if (!accessToken || !selectedBranchId || !selectedDate) return;
    setIsLoading(true);
    setReport(null);
    try {
      const data = await reportService.getAccountantReconciliation(accessToken, {
        date: selectedDate,
        organizationId: selectedBranchId,
      });
      setReport(data);
      setDrillDownOpen(false);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load reconciliation report.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedBranchId, selectedDate, toast]);

  useEffect(() => {
    if (selectedBranchId) {
      void load();
    }
  }, [load, selectedBranchId]);

  const creditTotal = report
    ? Number.parseFloat(report.summary.houseAccount) +
      Number.parseFloat(report.summary.corporateAccount) +
      Number.parseFloat(report.summary.customerCredit)
    : 0;

  const branchName = branches.find((b) => b.id === selectedBranchId)?.name ?? '';

  return (
    <PageLayout className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Reconciliation"
          subtitle="Verify daily collections against M-Pesa statements and cash totals"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={isLoading || !selectedBranchId}
          className="flex shrink-0 items-center gap-1.5 self-start text-stone-500 sm:self-auto"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Select
            label="Branch"
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="mb-1.5 block text-label-sm font-medium text-stone-700">Date</label>
          <input
            type="date"
            value={selectedDate}
            max={toYmd(new Date())}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full rounded-sm border border-stone-200 bg-parchment px-3 py-2 text-body-sm text-stone-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>
        <Button
          onClick={() => void load()}
          disabled={isLoading || !selectedBranchId}
          className="shrink-0 sm:mb-0"
        >
          Load Report
        </Button>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-stone-200 bg-white px-4 py-4">
              <SkeletonBlock className="mb-2 h-3 w-20 rounded" />
              <SkeletonBlock className="h-8 w-32 rounded" />
            </div>
          ))}
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SummaryStatCard
              label="M-Pesa"
              value={formatCurrency(report.summary.mpesa)}
              accent="green"
            />
            <SummaryStatCard
              label="Cash"
              value={formatCurrency(report.summary.cash)}
              accent="amber"
            />
            <SummaryStatCard
              label="Card"
              value={formatCurrency(report.summary.card)}
              accent="blue"
            />
            <SummaryStatCard
              label="Credit Extended"
              value={formatCurrency(creditTotal)}
              accent={creditTotal > 0 ? 'red' : undefined}
            />
          </div>

          {/* Waiter Collections Table */}
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-100 px-5 py-4">
              <h3 className="text-heading-sm font-semibold text-stone-900">Waiter Collections</h3>
              <p className="mt-0.5 text-caption text-stone-500">
                {branchName} · {selectedDate} · verify cash handed over by each waiter
              </p>
            </div>

            {report.waiters.length === 0 ? (
              <p className="px-5 py-8 text-center text-body-sm text-stone-400">
                No orders recorded for this date.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="border-b border-stone-100 bg-stone-50/60">
                      <th className="px-5 py-2.5 text-left text-label-sm font-medium text-stone-500">Waiter</th>
                      <th className="px-4 py-2.5 text-right text-label-sm font-medium text-stone-500">Orders</th>
                      <th className="px-4 py-2.5 text-right text-label-sm font-medium text-[#1A6B3C]">M-Pesa</th>
                      <th className="px-4 py-2.5 text-right text-label-sm font-medium text-stone-500">Cash</th>
                      <th className="px-4 py-2.5 text-right text-label-sm font-medium text-[#1D4ED8]">Card</th>
                      <th className="px-4 py-2.5 text-right text-label-sm font-medium text-[#92650A]">Credit</th>
                      <th className="px-5 py-2.5 text-right text-label-sm font-medium text-stone-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {report.waiters.map((waiter) => {
                      const wCredit =
                        Number.parseFloat(waiter.paymentBreakdown.houseAccount) +
                        Number.parseFloat(waiter.paymentBreakdown.corporateAccount) +
                        Number.parseFloat(waiter.paymentBreakdown.customerCredit);
                      return (
                        <tr key={waiter.id} className="transition-colors hover:bg-stone-50/60">
                          <td className="px-5 py-3.5">
                            <span className="text-body-sm font-medium text-stone-900">{waiter.name}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right text-body-sm text-stone-600">
                            {waiter.ordersHandled}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-[#1A6B3C]">
                            {formatCurrency(waiter.paymentBreakdown.mpesa)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-stone-700">
                            {formatCurrency(waiter.paymentBreakdown.cash)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-[#1D4ED8]">
                            {formatCurrency(waiter.paymentBreakdown.card)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-body-sm tabular-nums text-[#92650A]">
                            {formatCurrency(wCredit)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-body-sm font-semibold tabular-nums text-stone-900">
                            {formatCurrency(waiter.paymentBreakdown.total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-stone-200 bg-stone-50">
                      <td className="px-5 py-3 text-label-sm font-semibold text-stone-700">Total</td>
                      <td className="px-4 py-3 text-right text-label-sm font-semibold text-stone-700">
                        {report.orders.length}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-label-sm font-semibold tabular-nums text-[#1A6B3C]">
                        {formatCurrency(report.summary.mpesa)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-label-sm font-semibold tabular-nums text-stone-900">
                        {formatCurrency(report.summary.cash)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-label-sm font-semibold tabular-nums text-[#1D4ED8]">
                        {formatCurrency(report.summary.card)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-label-sm font-semibold tabular-nums text-[#92650A]">
                        {formatCurrency(creditTotal)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-label-sm font-bold tabular-nums text-espresso">
                        {formatCurrency(report.summary.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Order Detail — collapsible drill-down */}
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
            <button
              onClick={() => setDrillDownOpen((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-stone-50/60"
            >
              <div>
                <h3 className="text-heading-sm font-semibold text-stone-900">Order Detail</h3>
                <p className="mt-0.5 text-caption text-stone-500">
                  Drill into individual orders — use when totals don&apos;t match your statement
                </p>
              </div>
              {drillDownOpen ? (
                <ChevronDown size={18} className="shrink-0 text-stone-400" />
              ) : (
                <ChevronRight size={18} className="shrink-0 text-stone-400" />
              )}
            </button>
            {drillDownOpen && (
              <OrderDrillDown
                report={report}
                accessToken={accessToken ?? ''}
                organizationId={selectedBranchId}
                date={selectedDate}
              />
            )}
          </div>
        </>
      ) : !isLoading && selectedBranchId ? (
        <div className="rounded-xl border border-stone-200 bg-white px-5 py-12 text-center shadow-sm">
          <p className="text-body-md text-stone-400">Select a date and click Load Report to begin.</p>
        </div>
      ) : null}

    </PageLayout>
  );
}
