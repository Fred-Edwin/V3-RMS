'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  History,
  Info,
  List,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  X,
} from 'lucide-react';
import {
  Badge,
  type BadgeVariant,
  EmptyState,
  PageLayout,
  PageHeader,
  Select,
  SkeletonTable,
  Table,
  Textarea,
  type TableColumn,
} from '@/components/ui';
import { Input } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/cn';
import { branchService, type BranchDto } from '@/services/branchService';
import { orderCorrectionService } from '@/services/orderCorrectionService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type {
  ListOrderCorrectionsQuery,
  OrderCorrectionAuditEntry,
  OrderCorrectionDetail,
  OrderCorrectionListItem,
  OrderStatus,
} from '@/types/orderCorrection';

// ── Helpers ────────────────────────────────────────────────────────────────────

type CorrectionAction =
  | 'mpesa'
  | 'method'
  | 'force-ready'
  | 'revert-auth'
  | 'remove-item'
  | 'revert-ticket'
  | 'adjust-total'
  | '';


const STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  PENDING: 'pending',
  IN_PROGRESS: 'inprogress',
  READY: 'ready',
  AWAITING_AUTHORIZATION: 'awaiting',
  AWAITING_CANCELLATION_APPROVAL: 'cancellationPending',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
};

const TYPE_LABEL: Record<string, string> = {
  DINE_IN: 'Dine-In',
  TAKE_AWAY: 'Take-Away',
  DELIVERY: 'Delivery',
};

const METHOD_LABEL: Record<string, string> = {
  MPESA: 'M-Pesa',
  CASH: 'Cash',
  CARD: 'Card',
  SPLIT: 'Split',
  GUEST_SPLIT: 'Guest Split',
  HOUSE_ACCOUNT: 'House Acc',
  CORPORATE_ACCOUNT: 'Corporate',
  CUSTOMER_CREDIT: 'Credit',
};

const ACTION_LABELS: Record<string, string> = {
  CORRECT_MPESA_CODE: 'M-Pesa Code Corrected',
  CORRECT_PAYMENT_METHOD: 'Payment Method Changed',
  FORCE_ORDER_READY: 'Order Forced to READY',
  REVERT_AWAITING_AUTH: 'Auth Reverted → READY',
  REMOVE_ORDER_ITEM: 'Item Removed',
  REVERT_REJECTED_TICKET: 'Rejected Ticket Reverted → PENDING',
  ADJUST_ORDER_TOTAL: 'Total Adjusted',
};

const formatKES = (val: string | number): string => {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const todayYmd = (): string => new Date().toISOString().slice(0, 10);

const isWithin7Days = (createdAt: string): boolean => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  return new Date(createdAt) >= cutoff;
};

// ── Table column definitions ───────────────────────────────────────────────────

type OrderRow = Record<string, unknown> & OrderCorrectionListItem;

// ── Main component ─────────────────────────────────────────────────────────────

export default function OrderCorrectionConsolePage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((s) => s.accessToken);

  // List state
  const [orders, setOrders] = useState<OrderCorrectionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [branches, setBranches] = useState<BranchDto[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState(todayYmd());
  const [dateTo, setDateTo] = useState(todayYmd());

  // Sheet state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrderCorrectionDetail | null>(null);
  const [auditLog, setAuditLog] = useState<OrderCorrectionAuditEntry[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<'actions' | 'audit'>('actions');

  // Action form state
  const [activeAction, setActiveAction] = useState<CorrectionAction>('');
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [mpesaCode, setMpesaCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [newTotal, setNewTotal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadOrders = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const query: ListOrderCorrectionsQuery = { page, perPage: 50 };
      if (branchId) query.branchId = branchId;
      if (status) query.status = status;
      if (dateFrom) query.dateFrom = dateFrom;
      if (dateTo) query.dateTo = dateTo;
      if (search.trim()) query.search = search.trim();

      const result = await orderCorrectionService.listOrders(query, accessToken);
      setOrders(result.orders);
      setTotal(result.pagination.total);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load orders';
      toast({ variant: 'error', title: 'Load failed', message: msg });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, page, branchId, status, dateFrom, dateTo, search, toast]);

  const loadDetail = useCallback(async (orderId: string) => {
    if (!accessToken) return;
    setIsLoadingDetail(true);
    try {
      const [det, log] = await Promise.all([
        orderCorrectionService.getOrderDetail(orderId, accessToken),
        orderCorrectionService.getAuditLog(orderId, accessToken),
      ]);
      setDetail(det);
      setAuditLog(log);
      setMpesaCode(det.mpesaCode ?? '');
      setPaymentMethod(det.paymentMethod ?? '');
      setNewTotal(det.total);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load order detail';
      toast({ variant: 'error', title: 'Load failed', message: msg });
    } finally {
      setIsLoadingDetail(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!accessToken) return;
    branchService.listBranches(accessToken).then(setBranches).catch(() => undefined);
  }, [accessToken]);

  // ── Sheet interaction ───────────────────────────────────────────────────────

  const openSheet = useCallback((orderId: string) => {
    setSelectedId(orderId);
    setActiveTab('actions');
    setActiveAction('');
    setReason('');
    setPendingItemId(null);
    setPendingTicketId(null);
    void loadDetail(orderId);
  }, [loadDetail]);

  const closeSheet = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
    setAuditLog([]);
    setActiveAction('');
    setReason('');
    setPendingItemId(null);
    setPendingTicketId(null);
  }, []);

  const resetForm = useCallback(() => {
    setActiveAction('');
    setReason('');
    setPendingItemId(null);
    setPendingTicketId(null);
    setMpesaCode(detail?.mpesaCode ?? '');
    setNewTotal(detail?.total ?? '');
  }, [detail]);

  // ── Correction submissions ──────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!accessToken || !detail) return;
    if (reason.trim().length < 10) {
      toast({ variant: 'warning', title: 'Reason too short', message: 'Please provide at least 10 characters.' });
      return;
    }

    setIsSubmitting(true);
    try {
      switch (activeAction) {
        case 'mpesa':
          await orderCorrectionService.correctMpesaCode(detail.id, { mpesaCode: mpesaCode.trim(), reason: reason.trim() }, accessToken);
          toast({ variant: 'success', title: 'M-Pesa code corrected' });
          break;
        case 'method':
          await orderCorrectionService.correctPaymentMethod(detail.id, { paymentMethod, reason: reason.trim() }, accessToken);
          toast({ variant: 'success', title: 'Payment method updated' });
          break;
        case 'force-ready':
          await orderCorrectionService.forceOrderReady(detail.id, { reason: reason.trim() }, accessToken);
          toast({ variant: 'success', title: 'Order forced to READY' });
          break;
        case 'revert-auth':
          await orderCorrectionService.revertAwaitingAuth(detail.id, { reason: reason.trim() }, accessToken);
          toast({ variant: 'success', title: 'Authorization reverted' });
          break;
        case 'remove-item':
          if (!pendingItemId) return;
          await orderCorrectionService.removeOrderItem(detail.id, pendingItemId, { reason: reason.trim() }, accessToken);
          toast({ variant: 'success', title: 'Item removed' });
          break;
        case 'revert-ticket':
          if (!pendingTicketId) return;
          await orderCorrectionService.revertRejectedTicket(detail.id, pendingTicketId, { reason: reason.trim() }, accessToken);
          toast({ variant: 'success', title: 'Ticket reverted — station notified' });
          break;
        case 'adjust-total': {
          const parsed = parseFloat(newTotal);
          if (isNaN(parsed) || parsed < 0) {
            toast({ variant: 'warning', title: 'Invalid total', message: 'Enter a valid non-negative amount.' });
            setIsSubmitting(false);
            return;
          }
          await orderCorrectionService.adjustOrderTotal(detail.id, { newTotal: parsed, reason: reason.trim() }, accessToken);
          toast({ variant: 'success', title: 'Order total adjusted' });
          break;
        }
        default:
          return;
      }
      resetForm();
      await loadDetail(detail.id);
      await loadOrders();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Correction failed';
      toast({ variant: 'error', title: 'Correction failed', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  }, [accessToken, detail, activeAction, reason, mpesaCode, paymentMethod, newTotal, pendingItemId, pendingTicketId, resetForm, loadDetail, loadOrders, toast]);

  // ── Table columns ───────────────────────────────────────────────────────────

  const columns: TableColumn<OrderRow>[] = useMemo(() => [
    {
      key: 'dailyNumber',
      label: 'Order',
      render: (_value, row) => (
        <div>
          <div className="font-bold text-stone-900">#{row.dailyNumber}</div>
          <div className="text-[11px] text-stone-400">
            {row.tableNumber ?? TYPE_LABEL[row.type] ?? row.type}
          </div>
        </div>
      ),
    },
    {
      key: 'organizationName',
      label: 'Branch',
      render: (_value, row) => <span className="text-stone-500 text-[12px]">{row.organizationName}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (_value, row) => (
        <Badge variant={STATUS_VARIANT[row.status]} />
      ),
    },
    {
      key: 'paymentMethod',
      label: 'Payment',
      render: (_value, row) => (
        <div>
          <div className="text-[12px] text-stone-600">
            {row.paymentMethod ? METHOD_LABEL[row.paymentMethod] ?? row.paymentMethod : '—'}
          </div>
          {row.mpesaCode && (
            <div className="text-[10.5px] text-stone-400 font-mono">{row.mpesaCode}</div>
          )}
        </div>
      ),
    },
    {
      key: 'total',
      label: 'Total',
      render: (_value, row) => (
        <span className="font-semibold text-stone-900 text-[12.5px]">
          {formatKES(row.total)}
        </span>
      ),
    },
    {
      key: 'orderDate',
      label: 'Date',
      render: (_value, row) => (
        <div>
          <div className="text-[12px]">{formatDate(row.orderDate)}</div>
          <div className="text-[10.5px] text-stone-400">
            {new Date(row.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ),
    },
  ], []);

  // ── Availability guards (what corrections are possible for this order) ───────

  const canCorrectMpesa = detail?.status === 'CLOSED' &&
    (detail.paymentMethod === 'MPESA' || detail.paymentMethod === 'SPLIT' || detail.paymentMethod === 'GUEST_SPLIT');
  const canChangeMethod = detail?.status === 'CLOSED';
  const canForceReady = detail?.status === 'IN_PROGRESS' &&
    detail.prepTickets.some((t) => t.status === 'REJECTED') &&
    detail.prepTickets.every((t) => t.status === 'REJECTED' || t.status === 'READY');
  const canRevertAuth = detail?.status === 'AWAITING_AUTHORIZATION' && !!detail.pendingAuthRequestId;
  const canRemoveItem = detail !== null &&
    detail.status !== 'CANCELLED' &&
    detail.status !== 'PENDING' &&
    detail.items.length > 1;
  const canAdjustTotal = detail !== null && detail.status !== 'CANCELLED';
  const hasRevertibleTickets = detail !== null && detail.prepTickets.some((t) => t.status === 'REJECTED');
  const locked = detail ? !isWithin7Days(detail.createdAt) : false;

  // ── Render ──────────────────────────────────────────────────────────────────

  const rows: OrderRow[] = orders as OrderRow[];

  return (
    <PageLayout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Page header */}
        <div className="px-6 pt-5 pb-0 flex-shrink-0">
          <PageHeader
            title="Order Correction Console"
            subtitle="Audited corrections across all branches. Every change is permanently logged."
          />
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold
              bg-red-50 text-red-700 border border-red-200">
              <Shield size={10} />
              SYSTEM_ADMIN Only
            </span>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 flex items-center gap-2 flex-shrink-0 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Order # or table…"
              className="pl-8 h-8 text-sm w-48"
            />
          </div>

          <Select
            value={branchId}
            onChange={(e) => { setBranchId(e.target.value); setPage(1); }}
            options={[
              { value: '', label: 'All Branches' },
              ...branches.map((b) => ({ value: b.id, label: b.name })),
            ]}
            className="h-8 text-sm"
          />

          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'IN_PROGRESS', label: 'In Progress' },
              { value: 'READY', label: 'Ready' },
              { value: 'CLOSED', label: 'Closed' },
              { value: 'AWAITING_AUTHORIZATION', label: 'Awaiting Auth' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ]}
            className="h-8 text-sm"
          />

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-8 px-2 text-sm border border-stone-200 rounded-md bg-white text-stone-700 outline-none focus:border-amber-600"
          />
          <span className="text-stone-300 text-xs">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-8 px-2 text-sm border border-stone-200 rounded-md bg-white text-stone-700 outline-none focus:border-amber-600"
          />

          <button
            onClick={() => void loadOrders()}
            className="h-8 w-8 flex items-center justify-center border border-stone-200 rounded-md bg-white text-stone-400 hover:bg-stone-50 hover:text-stone-600"
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>

          <div className="ml-auto text-[11.5px] text-stone-400">{total} order{total !== 1 ? 's' : ''}</div>
        </div>

        {/* Split pane */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Table */}
          <div className={cn('flex-1 min-w-0 overflow-auto px-6 pb-6', selectedId ? 'pr-0' : '')}>
            {isLoading ? (
              <SkeletonTable rows={8} columns={6} />
            ) : orders.length === 0 ? (
              <EmptyState
                icon={<List size={32} className="text-stone-300" />}
                heading="No orders found"
                body="Adjust filters to find the order you need to correct."
              />
            ) : (
              <Table
                columns={columns}
                data={rows}
                keyField="id"
                onRowClick={(row) => openSheet(row.id as string)}
                getRowClassName={(row) =>
                  row.id === selectedId ? 'bg-amber-50/60 ring-inset ring-1 ring-amber-200' : ''
                }
              />
            )}
          </div>

          {/* Right sheet */}
          {selectedId && (
            <div className="w-[420px] flex-shrink-0 border-l border-stone-200 bg-white flex flex-col shadow-lg">
              {isLoadingDetail || !detail ? (
                <div className="flex-1 flex items-center justify-center text-stone-400">
                  <RefreshCw size={20} className="animate-spin" />
                </div>
              ) : (
                <>
                  {/* Sheet header */}
                  <div className="px-4 pt-3 pb-0 border-b border-stone-200 flex-shrink-0">
                    <div className="flex items-start justify-between mb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-extrabold text-stone-900 tracking-tight">
                            #{detail.dailyNumber}
                          </span>
                          <Badge variant={STATUS_VARIANT[detail.status]} />
                          {locked && (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                              LOCKED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                          {detail.organizationName} · {detail.tableNumber ?? TYPE_LABEL[detail.type]} · {formatDateTime(detail.createdAt)} · {detail.createdByName}
                        </div>
                      </div>
                      <button
                        onClick={closeSheet}
                        className="w-6 h-6 flex items-center justify-center rounded border border-stone-200 text-stone-400 hover:bg-stone-100 hover:text-stone-700 flex-shrink-0"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex">
                      <button
                        className={cn(
                          'px-3.5 py-2 text-[12px] font-medium border-b-2 -mb-px',
                          activeTab === 'actions'
                            ? 'border-amber-700 text-stone-900 font-bold'
                            : 'border-transparent text-stone-400 hover:text-stone-700',
                        )}
                        onClick={() => setActiveTab('actions')}
                      >
                        Correction Actions
                      </button>
                      <button
                        className={cn(
                          'px-3.5 py-2 text-[12px] font-medium border-b-2 -mb-px flex items-center gap-1.5',
                          activeTab === 'audit'
                            ? 'border-amber-700 text-stone-900 font-bold'
                            : 'border-transparent text-stone-400 hover:text-stone-700',
                        )}
                        onClick={() => setActiveTab('audit')}
                      >
                        Audit Log
                        {auditLog.length > 0 && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            {auditLog.length}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Sheet body */}
                  <div className="flex-1 overflow-y-auto">

                    {/* ── ACTIONS TAB ─────────────────────────────────────── */}
                    {activeTab === 'actions' && (
                      <div>
                        {/* Items table — always visible */}
                        <div className="border-b border-stone-200">
                          <div className="flex items-center justify-between px-4 py-2 bg-stone-50 border-b border-stone-200">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                              Order Items
                            </span>
                            <span className="text-[11px] text-stone-500">
                              {detail.paymentMethod ? METHOD_LABEL[detail.paymentMethod] ?? detail.paymentMethod : '—'}
                              {' · '}
                              <strong className="text-stone-700">{formatKES(detail.total)}</strong>
                            </span>
                          </div>

                          <table className="w-full border-collapse">
                            <tbody>
                              {detail.items.map((item) => (
                                <tr
                                  key={item.id}
                                  className={cn(
                                    'border-b border-stone-100',
                                    pendingItemId === item.id ? 'bg-red-50' : '',
                                  )}
                                >
                                  <td className="px-4 py-2 text-[12px]">
                                    <div className="font-medium text-stone-700">{item.name}</div>
                                    {item.notes && (
                                      <div className="text-[10.5px] text-stone-400">{item.notes}</div>
                                    )}
                                  </td>
                                  <td className="px-2 py-2 text-center text-[12px] text-stone-500 w-8">
                                    ×{item.quantity}
                                  </td>
                                  <td className="px-4 py-2 text-right text-[12px] font-semibold text-stone-700 w-20 whitespace-nowrap">
                                    {formatKES(item.subtotal)}
                                  </td>
                                  <td className="px-2 py-2 w-8 text-center">
                                    {canRemoveItem && !locked && (
                                      <button
                                        onClick={() => {
                                          setPendingItemId(item.id);
                                          setActiveAction('remove-item');
                                          setReason('');
                                        }}
                                        className="w-5 h-5 flex items-center justify-center rounded border border-stone-200 text-stone-400
                                          hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                                        title="Remove item"
                                      >
                                        <X size={11} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-stone-50 border-t border-stone-200">
                                <td
                                  colSpan={2}
                                  className="px-4 py-2 text-[11px] uppercase font-bold tracking-widest text-stone-500"
                                >
                                  Total
                                </td>
                                <td className="px-4 py-2 text-right text-[13px] font-extrabold text-stone-900 whitespace-nowrap">
                                  {formatKES(detail.total)}
                                </td>
                                <td />
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Action picker */}
                        <div className="p-4">
                          {locked ? (
                            <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-[12px] text-red-700">
                              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                              <span>This order is older than 7 days. Corrections are locked.</span>
                            </div>
                          ) : (
                            <>
                              {/* Availability chips */}
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {[
                                  { key: 'mpesa', label: 'M-Pesa Code', ok: canCorrectMpesa },
                                  { key: 'method', label: 'Payment Method', ok: canChangeMethod },
                                  { key: 'remove-item', label: 'Remove Item', ok: canRemoveItem },
                                  { key: 'adjust-total', label: 'Adjust Total', ok: canAdjustTotal },
                                  { key: 'force-ready', label: 'Force Ready', ok: canForceReady },
                                  { key: 'revert-auth', label: 'Revert Auth', ok: canRevertAuth },
                                  { key: 'revert-ticket', label: 'Revert Rejected Ticket', ok: hasRevertibleTickets },
                                ].map(({ key, label, ok }) => (
                                  <span
                                    key={key}
                                    className={cn(
                                      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-semibold border',
                                      ok
                                        ? 'bg-green-50 text-green-700 border-green-200'
                                        : 'bg-stone-100 text-stone-400 border-stone-200',
                                    )}
                                  >
                                    {ok ? <CheckCircle2 size={9} /> : null}
                                    {label}
                                  </span>
                                ))}
                              </div>

                              {/* Action selector */}
                              <Select
                                value={activeAction}
                                onChange={(e) => {
                                  setActiveAction(e.target.value as CorrectionAction);
                                  setReason('');
                                  setPendingItemId(null);
                                  setPendingTicketId(null);
                                }}
                                options={[
                                  { value: '', label: '— Select a correction to apply —' },
                                  ...(canCorrectMpesa ? [{ value: 'mpesa', label: 'Correct M-Pesa Code' }] : []),
                                  ...(canChangeMethod ? [{ value: 'method', label: 'Change Payment Method' }] : []),
                                  ...(canRemoveItem ? [{ value: 'remove-item', label: 'Remove Item (click × on item above first)' }] : []),
                                  ...(canAdjustTotal ? [{ value: 'adjust-total', label: 'Adjust Order Total' }] : []),
                                  ...(canForceReady ? [{ value: 'force-ready', label: 'Force Order → READY' }] : []),
                                  ...(canRevertAuth ? [{ value: 'revert-auth', label: 'Revert AWAITING_AUTH → READY' }] : []),
                                  ...(hasRevertibleTickets ? [{ value: 'revert-ticket', label: 'Revert Rejected Ticket → PENDING' }] : []),
                                ]}
                                className="w-full text-sm mb-3"
                              />

                              {/* Action-specific forms */}
                              {activeAction === 'mpesa' && (
                                <CorrectionForm
                                  callout={{ type: 'info', text: `Current code: ${detail.mpesaCode ?? '(none)'} — enter the corrected code.` }}
                                  extraFields={
                                    <div className="flex flex-col gap-1">
                                      <label className="text-[11px] font-semibold text-stone-600">Corrected M-Pesa Code <span className="text-red-600">*</span></label>
                                      <input
                                        type="text"
                                        value={mpesaCode}
                                        onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                                        className="h-8 px-2.5 border border-stone-200 rounded-md text-[12.5px] font-mono tracking-wider text-stone-900 outline-none focus:border-amber-600"
                                        placeholder="e.g. QHX7K2P1MN"
                                      />
                                    </div>
                                  }
                                  reason={reason}
                                  onReasonChange={setReason}
                                  onCancel={resetForm}
                                  onSubmit={() => void handleSubmit()}
                                  isSubmitting={isSubmitting}
                                  submitLabel="Apply Correction"
                                  submitVariant="primary"
                                />
                              )}

                              {activeAction === 'method' && (
                                <CorrectionForm
                                  callout={{ type: 'warning', text: 'Use only when the wrong payment method was recorded at close.' }}
                                  extraFields={
                                    <div className="flex flex-col gap-1">
                                      <label className="text-[11px] font-semibold text-stone-600">New Payment Method <span className="text-red-600">*</span></label>
                                      <Select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        options={[
                                          { value: 'MPESA', label: 'M-Pesa' },
                                          { value: 'CASH', label: 'Cash' },
                                          { value: 'CARD', label: 'Card' },
                                          { value: 'SPLIT', label: 'Split' },
                                        ]}
                                        className="h-8 text-sm"
                                      />
                                    </div>
                                  }
                                  reason={reason}
                                  onReasonChange={setReason}
                                  onCancel={resetForm}
                                  onSubmit={() => void handleSubmit()}
                                  isSubmitting={isSubmitting}
                                  submitLabel="Change Method"
                                  submitVariant="warning"
                                />
                              )}

                              {activeAction === 'remove-item' && (
                                <CorrectionForm
                                  callout={{
                                    type: 'warning',
                                    text: pendingItemId
                                      ? `Removing: ${detail.items.find((i) => i.id === pendingItemId)?.name ?? '—'}`
                                      : 'Click × next to an item above to select it for removal.',
                                  }}
                                  reason={reason}
                                  onReasonChange={setReason}
                                  onCancel={resetForm}
                                  onSubmit={() => void handleSubmit()}
                                  isSubmitting={isSubmitting || !pendingItemId}
                                  submitLabel="Confirm Removal"
                                  submitVariant="danger"
                                />
                              )}

                              {activeAction === 'adjust-total' && (
                                <CorrectionForm
                                  callout={{ type: 'error', text: 'Last resort only. Prefer item removal for a cleaner audit trail.' }}
                                  extraFields={
                                    <div className="flex flex-col gap-1">
                                      <label className="text-[11px] font-semibold text-stone-600">New Total (KES) <span className="text-red-600">*</span></label>
                                      <input
                                        type="number"
                                        value={newTotal}
                                        onChange={(e) => setNewTotal(e.target.value)}
                                        min={0}
                                        step={0.01}
                                        className="h-8 px-2.5 border border-stone-200 rounded-md text-[12.5px] text-stone-900 outline-none focus:border-amber-600"
                                      />
                                      <span className="text-[10.5px] text-stone-400">Current: {formatKES(detail.total)}</span>
                                    </div>
                                  }
                                  reason={reason}
                                  onReasonChange={setReason}
                                  onCancel={resetForm}
                                  onSubmit={() => void handleSubmit()}
                                  isSubmitting={isSubmitting}
                                  submitLabel="Adjust Total"
                                  submitVariant="danger"
                                />
                              )}

                              {activeAction === 'force-ready' && (
                                <CorrectionForm
                                  callout={{ type: 'warning', text: 'Forces the order to READY by bypassing the rejected prep ticket.' }}
                                  reason={reason}
                                  onReasonChange={setReason}
                                  onCancel={resetForm}
                                  onSubmit={() => void handleSubmit()}
                                  isSubmitting={isSubmitting}
                                  submitLabel="Force to READY"
                                  submitVariant="warning"
                                />
                              )}

                              {activeAction === 'revert-auth' && (
                                <CorrectionForm
                                  callout={{ type: 'warning', text: 'Deletes the pending house account auth request and returns the order to READY.' }}
                                  reason={reason}
                                  onReasonChange={setReason}
                                  onCancel={resetForm}
                                  onSubmit={() => void handleSubmit()}
                                  isSubmitting={isSubmitting}
                                  submitLabel="Revert Auth"
                                  submitVariant="warning"
                                />
                              )}

                              {activeAction === 'revert-ticket' && (
                                <CorrectionForm
                                  callout={{ type: 'info', text: 'Sets the ticket back to PENDING so the station can re-attempt it. The station display is notified immediately.' }}
                                  extraFields={
                                    <div className="flex flex-col gap-1">
                                      <label className="text-[11px] font-semibold text-stone-600">Select Rejected Ticket <span className="text-red-600">*</span></label>
                                      <div className="flex flex-col gap-1">
                                        {detail.prepTickets
                                          .filter((t) => t.status === 'REJECTED')
                                          .map((t) => (
                                            <button
                                              key={t.id}
                                              type="button"
                                              onClick={() => setPendingTicketId(t.id)}
                                              className={cn(
                                                'text-left px-2.5 py-1.5 rounded border text-[11.5px] transition-colors',
                                                pendingTicketId === t.id
                                                  ? 'border-amber-500 bg-amber-50 text-amber-800 font-semibold'
                                                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300',
                                              )}
                                            >
                                              {t.station} — seq #{t.sequence}
                                            </button>
                                          ))}
                                      </div>
                                    </div>
                                  }
                                  reason={reason}
                                  onReasonChange={setReason}
                                  onCancel={resetForm}
                                  onSubmit={() => void handleSubmit()}
                                  isSubmitting={isSubmitting || !pendingTicketId}
                                  submitLabel="Revert Ticket to PENDING"
                                  submitVariant="warning"
                                />
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── AUDIT TAB ───────────────────────────────────────── */}
                    {activeTab === 'audit' && (
                      <div>
                        {auditLog.length === 0 ? (
                          <EmptyState
                            icon={<History size={28} className="text-stone-300" />}
                            heading="No corrections yet"
                            body="Corrections applied to this order will appear here."
                          />
                        ) : (
                          <div className="p-4 flex flex-col gap-0">
                            {auditLog.map((entry, idx) => (
                              <div key={entry.id} className="flex gap-2.5 pb-4 relative">
                                {idx < auditLog.length - 1 && (
                                  <div className="absolute left-[13px] top-7 bottom-0 w-px bg-stone-200" />
                                )}
                                <div className={cn(
                                  'w-7 h-7 rounded-full flex-shrink-0 border flex items-center justify-center relative z-10',
                                  entry.details.action.includes('MPESA') || entry.details.action.includes('PAYMENT')
                                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                                    : entry.details.action.includes('ITEM')
                                    ? 'bg-red-50 border-red-200 text-red-600'
                                    : 'bg-amber-50 border-amber-200 text-amber-700',
                                )}>
                                  {entry.details.action.includes('MPESA') || entry.details.action.includes('PAYMENT')
                                    ? <CreditCard size={11} />
                                    : entry.details.action.includes('ITEM')
                                    ? <X size={11} />
                                    : <Pencil size={11} />}
                                </div>
                                <div className="flex-1">
                                  <div className="text-[12px] font-bold text-stone-700">
                                    {ACTION_LABELS[entry.details.action] ?? entry.details.action}
                                  </div>
                                  <div className="text-[10.5px] text-stone-400 mt-0.5">
                                    {entry.actor?.name ?? 'System'} · {formatDateTime(entry.createdAt)}
                                  </div>
                                  <div className="mt-1.5 px-2.5 py-1.5 rounded border border-stone-100 bg-stone-50 text-[11px] flex items-center gap-2">
                                    <span className="line-through text-red-600 font-mono">{entry.details.before}</span>
                                    <span className="text-stone-300">→</span>
                                    <span className="font-bold text-green-700 font-mono">{entry.details.after}</span>
                                  </div>
                                  <div className="text-[11px] text-stone-400 italic mt-1 px-0.5">
                                    &ldquo;{entry.details.reason}&rdquo;
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sheet footer */}
                  <div className="px-4 py-2.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-red-600">
                      <Shield size={11} />
                      {locked ? 'Locked — older than 7 days' : 'Corrections locked after 7 days'}
                    </div>
                    <div className="text-[10.5px] text-stone-400">All changes audited</div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

// ── CorrectionForm sub-component ──────────────────────────────────────────────

interface CorrectionFormProps {
  callout: { type: 'info' | 'warning' | 'error'; text: string };
  extraFields?: React.ReactNode;
  reason: string;
  onReasonChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitLabel: string;
  submitVariant: 'primary' | 'warning' | 'danger';
}

function CorrectionForm({
  callout,
  extraFields,
  reason,
  onReasonChange,
  onCancel,
  onSubmit,
  isSubmitting,
  submitLabel,
  submitVariant,
}: CorrectionFormProps) {
  const calloutClasses = {
    info:    'bg-blue-50 border-blue-200 text-blue-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error:   'bg-red-50 border-red-200 text-red-700',
  };

  const calloutIcon = {
    info:    <Info size={13} className="mt-0.5 flex-shrink-0" />,
    warning: <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />,
    error:   <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />,
  };

  const submitClasses = {
    primary: 'bg-stone-900 text-white hover:bg-stone-800',
    warning: 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-50',
    danger:  'bg-white text-red-700 border border-red-300 hover:bg-red-50',
  };

  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className={cn('flex items-start gap-2 p-2.5 rounded-md border text-[11.5px]', calloutClasses[callout.type])}>
        {calloutIcon[callout.type]}
        <span>{callout.text}</span>
      </div>

      {extraFields}

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-stone-600">
          Reason <span className="text-red-600">*</span>
        </label>
        <Textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Provide full justification for this correction…"
          rows={3}
          className="text-sm"
        />
        <span className="text-[10.5px] text-stone-400">Minimum 10 characters. Permanently logged.</span>
      </div>

      <div className="flex items-center gap-2 justify-end pt-1 border-t border-stone-100">
        <button
          onClick={onCancel}
          className="px-3 h-8 text-[12px] font-semibold text-stone-500 border border-stone-200 rounded-md hover:bg-stone-50"
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={isSubmitting || reason.trim().length < 10}
          className={cn(
            'px-3 h-8 text-[12px] font-semibold rounded-md disabled:opacity-40',
            submitClasses[submitVariant],
          )}
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  );
}
