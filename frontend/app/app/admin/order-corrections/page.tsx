'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Expand,
  History,
  Info,
  List,
  Lock,
  Minimize2,
  Pencil,
  RefreshCw,
  Search,
  Settings2,
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
  Textarea,
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

// ── Excel-style sheet style constants (matches Shift Management / Payroll) ──────

const SHEET_FONT = "'Calibri', 'Segoe UI', Arial, sans-serif";
const HEADER_BAND = '#2e5984';
const GRID_LINE = '#d0d0d0';
const FOOTER_BAR = '#44403c';

const sectionBandStyle: React.CSSProperties = {
  background: HEADER_BAND,
  border: '1px solid rgba(255,255,255,0.3)',
  height: 22,
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'white',
  verticalAlign: 'middle',
};

const colHeaderStyle: React.CSSProperties = {
  background: '#f0f0f0',
  border: `1px solid ${GRID_LINE}`,
  height: 34,
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#555',
  textAlign: 'left',
  padding: '0 8px',
  verticalAlign: 'middle',
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function OrderCorrectionConsolePage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((s) => s.accessToken);

  // List state
  const [orders, setOrders] = useState<OrderCorrectionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState(todayYmd());
  const [dateTo, setDateTo] = useState(todayYmd());

  // Popover state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
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

  // ── Popover interaction ─────────────────────────────────────────────────────

  const openPopover = useCallback((orderId: string, rect: DOMRect) => {
    setSelectedId(orderId);
    setAnchorRect(rect);
    setActiveTab('actions');
    setActiveAction('');
    setReason('');
    setPendingItemId(null);
    setPendingTicketId(null);
    void loadDetail(orderId);
  }, [loadDetail]);

  const closePopover = useCallback(() => {
    setSelectedId(null);
    setAnchorRect(null);
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

  // Close popover on Escape
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopover();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, closePopover]);

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

  // ── Sheet rendering ─────────────────────────────────────────────────────────

  const sheet = (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[20px] border border-stone-200 bg-white shadow-sm',
        isExpanded && 'rounded-none border-0',
      )}
    >
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6"><SkeletonTable rows={8} columns={7} /></div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<List size={32} className="text-stone-300" />}
            heading="No orders found"
            body="Adjust filters to find the order you need to correct."
          />
        ) : (
          <table
            style={{
              borderCollapse: 'collapse',
              fontFamily: SHEET_FONT,
              fontSize: 12,
              width: '100%',
              minWidth: 920,
              tableLayout: 'fixed',
            }}
          >
            <colgroup>
              <col style={{ width: 36 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 96 }} />
            </colgroup>
            <thead>
              {/* Section band */}
              <tr>
                <td style={{ ...sectionBandStyle, position: 'sticky', top: 0, left: 0, zIndex: 21, width: 36 }} />
                <td
                  colSpan={6}
                  style={{ ...sectionBandStyle, padding: '0 8px', textAlign: 'left', position: 'sticky', top: 0, zIndex: 9 }}
                >
                  Order Corrections — Cross-Branch Audit View
                </td>
                <td
                  style={{ ...sectionBandStyle, background: FOOTER_BAR, textAlign: 'center', position: 'sticky', top: 0, zIndex: 9 }}
                >
                  Correct
                </td>
              </tr>
              {/* Column headers */}
              <tr>
                <th style={{ ...colHeaderStyle, textAlign: 'center', position: 'sticky', top: 22, left: 0, zIndex: 21 }} />
                <th style={{ ...colHeaderStyle, borderRight: '2px solid #c5c5c5', position: 'sticky', top: 22, left: 36, zIndex: 19 }}>Order</th>
                <th style={{ ...colHeaderStyle, position: 'sticky', top: 22, zIndex: 9 }}>Branch</th>
                <th style={{ ...colHeaderStyle, position: 'sticky', top: 22, zIndex: 9 }}>Status</th>
                <th style={{ ...colHeaderStyle, position: 'sticky', top: 22, zIndex: 9 }}>Payment</th>
                <th style={{ ...colHeaderStyle, textAlign: 'right', position: 'sticky', top: 22, zIndex: 9 }}>Total</th>
                <th style={{ ...colHeaderStyle, position: 'sticky', top: 22, zIndex: 9 }}>Date</th>
                <th style={{ ...colHeaderStyle, textAlign: 'center', position: 'sticky', top: 22, zIndex: 9 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, idx) => {
                const rowLocked = !isWithin7Days(order.createdAt);
                const isEven = idx % 2 === 1;
                const isSelected = order.id === selectedId;
                const baseBg = isSelected
                  ? '#fdf6e9'
                  : rowLocked
                    ? '#f3f3f3'
                    : isEven
                      ? '#fbfbfb'
                      : '#ffffff';
                const textColor = rowLocked ? '#9a948f' : '#1a0a00';

                return (
                  <tr key={order.id} style={{ background: baseBg }}>
                    {/* Row-number gutter + lock indicator */}
                    <td
                      style={{
                        border: `1px solid ${GRID_LINE}`,
                        background: isSelected ? '#f8edd6' : isEven ? '#ebebeb' : '#f0f0f0',
                        textAlign: 'center',
                        position: 'sticky',
                        left: 0,
                        zIndex: 4,
                        height: 40,
                      }}
                    >
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span style={{ fontSize: 10, color: '#888', lineHeight: 1 }}>{idx + 1}</span>
                        {rowLocked && <Lock size={9} className="text-red-600" />}
                      </div>
                    </td>
                    {/* Order (sticky) */}
                    <td
                      style={{
                        border: `1px solid ${GRID_LINE}`,
                        borderRight: '2px solid #c5c5c5',
                        padding: '0 8px',
                        position: 'sticky',
                        left: 36,
                        background: baseBg,
                        zIndex: 3,
                        height: 40,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: textColor }}>#{order.dailyNumber}</div>
                      <div style={{ fontSize: 10, color: '#a8a29e' }}>
                        {order.tableNumber ?? TYPE_LABEL[order.type] ?? order.type}
                      </div>
                    </td>
                    {/* Branch */}
                    <td style={{ border: `1px solid ${GRID_LINE}`, padding: '0 8px', color: rowLocked ? '#a8a29e' : '#57534e' }}>
                      {order.organizationName}
                    </td>
                    {/* Status */}
                    <td style={{ border: `1px solid ${GRID_LINE}`, padding: '0 8px' }}>
                      <Badge variant={STATUS_VARIANT[order.status]} />
                    </td>
                    {/* Payment */}
                    <td style={{ border: `1px solid ${GRID_LINE}`, padding: '0 8px' }}>
                      <div style={{ color: rowLocked ? '#a8a29e' : '#57534e' }}>
                        {order.paymentMethod ? METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod : '—'}
                      </div>
                      {order.mpesaCode && (
                        <div style={{ fontSize: 10, color: '#a8a29e', fontFamily: 'monospace' }}>{order.mpesaCode}</div>
                      )}
                    </td>
                    {/* Total */}
                    <td style={{ border: `1px solid ${GRID_LINE}`, padding: '0 8px', textAlign: 'right', fontWeight: 600, color: textColor }}>
                      {formatKES(order.total)}
                    </td>
                    {/* Date */}
                    <td style={{ border: `1px solid ${GRID_LINE}`, padding: '0 8px', color: rowLocked ? '#a8a29e' : '#57534e' }}>
                      <div>{formatDate(order.orderDate)}</div>
                      <div style={{ fontSize: 10, color: '#a8a29e' }}>
                        {new Date(order.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    {/* Action */}
                    <td style={{ border: `1px solid ${GRID_LINE}`, padding: 0, textAlign: 'center' }}>
                      {rowLocked ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600"
                          title="Older than 7 days — corrections locked"
                        >
                          <Lock size={10} />
                          Locked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            const rect = (e.currentTarget.closest('tr') as HTMLElement).getBoundingClientRect();
                            openPopover(order.id, rect);
                          }}
                          className={cn(
                            'inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-bold transition-colors',
                            isSelected
                              ? 'border-amber-400 bg-amber-100 text-amber-800'
                              : 'border-stone-300 bg-white text-stone-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700',
                          )}
                        >
                          <Settings2 size={11} />
                          Correct
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {/* Charcoal status footer bar */}
      <div
        className="flex h-6 shrink-0 items-center justify-between gap-4 overflow-hidden px-3 text-[11px] font-semibold text-white/90"
        style={{ background: FOOTER_BAR, fontFamily: SHEET_FONT }}
      >
        <span className="flex items-center gap-1.5">
          <Shield size={11} />
          Audited correction console — every change permanently logged
        </span>
        <span>{total} order{total !== 1 ? 's' : ''}</span>
        <span>Cross-branch view</span>
        <span>7-day correction window</span>
      </div>
    </div>
  );

  // ── Toolbar ─────────────────────────────────────────────────────────────────

  const toolbar = (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Order # or table…"
          className="pl-8 h-8 text-sm w-48"
        />
      </div>

      <Select
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        options={[
          { value: '', label: 'All Branches' },
          ...branches.map((b) => ({ value: b.id, label: b.name })),
        ]}
        className="h-8 text-sm"
      />

      <Select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
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
        onChange={(e) => setDateFrom(e.target.value)}
        className="h-8 px-2 text-sm border border-stone-200 rounded-md bg-white text-stone-700 outline-none focus:border-amber-600"
      />
      <span className="text-stone-300 text-xs">—</span>
      <input
        type="date"
        value={dateTo}
        onChange={(e) => setDateTo(e.target.value)}
        className="h-8 px-2 text-sm border border-stone-200 rounded-md bg-white text-stone-700 outline-none focus:border-amber-600"
      />

      <button
        onClick={() => void loadOrders()}
        className="h-8 w-8 flex items-center justify-center border border-stone-200 rounded-md bg-white text-stone-400 hover:bg-stone-50 hover:text-stone-600"
        title="Refresh"
      >
        <RefreshCw size={13} />
      </button>

      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="h-8 flex items-center gap-1.5 border border-stone-200 rounded-md bg-white px-2.5 text-[12px] font-semibold text-stone-600 hover:bg-stone-50"
      >
        {isExpanded ? <Minimize2 size={13} /> : <Expand size={13} />}
        {isExpanded ? 'Collapse' : 'Expand sheet'}
      </button>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {isExpanded ? (
        <div className="fixed inset-0 z-40 flex flex-col gap-3 bg-[#faf7f4] p-4">
          {toolbar}
          {sheet}
        </div>
      ) : (
        <PageLayout className="!mx-0 flex h-screen min-h-0 !max-w-none flex-col !px-6 !py-4">
          <div className="shrink-0">
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
          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
            {toolbar}
            {sheet}
          </div>
        </PageLayout>
      )}

      {/* Row-anchored correction popover */}
      {selectedId && (
        <CorrectionPopover
          anchorRect={anchorRect}
          isExpanded={isExpanded}
          onClose={closePopover}
          detail={detail}
          auditLog={auditLog}
          isLoadingDetail={isLoadingDetail}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          locked={locked}
          activeAction={activeAction}
          setActiveAction={setActiveAction}
          pendingItemId={pendingItemId}
          setPendingItemId={setPendingItemId}
          pendingTicketId={pendingTicketId}
          setPendingTicketId={setPendingTicketId}
          reason={reason}
          setReason={setReason}
          mpesaCode={mpesaCode}
          setMpesaCode={setMpesaCode}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          newTotal={newTotal}
          setNewTotal={setNewTotal}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          resetForm={resetForm}
          guards={{ canCorrectMpesa: !!canCorrectMpesa, canChangeMethod: !!canChangeMethod, canForceReady: !!canForceReady, canRevertAuth: !!canRevertAuth, canRemoveItem, canAdjustTotal, hasRevertibleTickets }}
        />
      )}
    </>
  );
}

// ── CorrectionPopover ─────────────────────────────────────────────────────────

interface PopoverGuards {
  canCorrectMpesa: boolean;
  canChangeMethod: boolean;
  canForceReady: boolean;
  canRevertAuth: boolean;
  canRemoveItem: boolean;
  canAdjustTotal: boolean;
  hasRevertibleTickets: boolean;
}

interface CorrectionPopoverProps {
  anchorRect: DOMRect | null;
  isExpanded: boolean;
  onClose: () => void;
  detail: OrderCorrectionDetail | null;
  auditLog: OrderCorrectionAuditEntry[];
  isLoadingDetail: boolean;
  activeTab: 'actions' | 'audit';
  setActiveTab: (t: 'actions' | 'audit') => void;
  locked: boolean;
  activeAction: CorrectionAction;
  setActiveAction: (a: CorrectionAction) => void;
  pendingItemId: string | null;
  setPendingItemId: (v: string | null) => void;
  pendingTicketId: string | null;
  setPendingTicketId: (v: string | null) => void;
  reason: string;
  setReason: (v: string) => void;
  mpesaCode: string;
  setMpesaCode: (v: string) => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  newTotal: string;
  setNewTotal: (v: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  resetForm: () => void;
  guards: PopoverGuards;
}

const POPOVER_WIDTH = 372;

function CorrectionPopover({
  anchorRect,
  isExpanded,
  onClose,
  detail,
  auditLog,
  isLoadingDetail,
  activeTab,
  setActiveTab,
  locked,
  activeAction,
  setActiveAction,
  pendingItemId,
  setPendingItemId,
  pendingTicketId,
  setPendingTicketId,
  reason,
  setReason,
  mpesaCode,
  setMpesaCode,
  paymentMethod,
  setPaymentMethod,
  newTotal,
  setNewTotal,
  isSubmitting,
  onSubmit,
  resetForm,
  guards,
}: CorrectionPopoverProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Position the panel next to the anchor row, clamped to viewport.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !anchorRect) return;
    const margin = 12;
    const panelHeight = panel.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer placing to the left of the row's right edge isn't ideal — anchor
    // to the right side of the viewport content, vertically near the row.
    let left = vw - POPOVER_WIDTH - margin;
    if (left < margin) left = margin;

    let top = anchorRect.top;
    if (top + panelHeight + margin > vh) top = vh - panelHeight - margin;
    if (top < margin) top = margin;

    setPos({ top, left });
  }, [anchorRect, detail, activeTab, activeAction]);

  return (
    <>
      {/* Click-away backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'transparent' }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="fixed z-50 flex flex-col rounded-lg border border-stone-300 bg-white shadow-2xl"
        style={{
          width: POPOVER_WIDTH,
          top: pos.top,
          left: pos.left,
          maxHeight: isExpanded ? 'calc(100vh - 24px)' : 'calc(100vh - 88px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isLoadingDetail || !detail ? (
          <div className="flex h-40 items-center justify-center text-stone-400">
            <RefreshCw size={20} className="animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-3.5 pt-2.5 pb-0 border-b border-stone-200 flex-shrink-0">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-extrabold text-stone-900 tracking-tight">
                      #{detail.dailyNumber}
                    </span>
                    <Badge variant={STATUS_VARIANT[detail.status]} />
                    {locked && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                        <Lock size={9} />
                        LOCKED
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-400 mt-0.5">
                    {detail.organizationName} · {detail.tableNumber ?? TYPE_LABEL[detail.type]} · {formatDateTime(detail.createdAt)}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-6 h-6 flex items-center justify-center rounded border border-stone-200 text-stone-400 hover:bg-stone-100 hover:text-stone-700 flex-shrink-0"
                >
                  <X size={13} />
                </button>
              </div>
              {/* Tabs */}
              <div className="flex">
                <button
                  className={cn(
                    'px-3 py-1.5 text-[12px] font-medium border-b-2 -mb-px',
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
                    'px-3 py-1.5 text-[12px] font-medium border-b-2 -mb-px flex items-center gap-1.5',
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

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'actions' && (
                <div>
                  {/* Items table */}
                  <div className="border-b border-stone-200">
                    <div className="flex items-center justify-between px-3.5 py-2 bg-stone-50 border-b border-stone-200">
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
                            className={cn('border-b border-stone-100', pendingItemId === item.id ? 'bg-red-50' : '')}
                          >
                            <td className="px-3.5 py-2 text-[12px]">
                              <div className="font-medium text-stone-700">{item.name}</div>
                              {item.notes && (
                                <div className="text-[10.5px] text-stone-400">{item.notes}</div>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center text-[12px] text-stone-500 w-8">
                              ×{item.quantity}
                            </td>
                            <td className="px-3.5 py-2 text-right text-[12px] font-semibold text-stone-700 w-20 whitespace-nowrap">
                              {formatKES(item.subtotal)}
                            </td>
                            <td className="px-2 py-2 w-8 text-center">
                              {guards.canRemoveItem && !locked && (
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
                            className="px-3.5 py-2 text-[11px] uppercase font-bold tracking-widest text-stone-500"
                          >
                            Total
                          </td>
                          <td className="px-3.5 py-2 text-right text-[13px] font-extrabold text-stone-900 whitespace-nowrap">
                            {formatKES(detail.total)}
                          </td>
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Action picker */}
                  <div className="p-3.5">
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
                            { key: 'mpesa', label: 'M-Pesa Code', ok: guards.canCorrectMpesa },
                            { key: 'method', label: 'Payment Method', ok: guards.canChangeMethod },
                            { key: 'remove-item', label: 'Remove Item', ok: guards.canRemoveItem },
                            { key: 'adjust-total', label: 'Adjust Total', ok: guards.canAdjustTotal },
                            { key: 'force-ready', label: 'Force Ready', ok: guards.canForceReady },
                            { key: 'revert-auth', label: 'Revert Auth', ok: guards.canRevertAuth },
                            { key: 'revert-ticket', label: 'Revert Rejected Ticket', ok: guards.hasRevertibleTickets },
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
                            ...(guards.canCorrectMpesa ? [{ value: 'mpesa', label: 'Correct M-Pesa Code' }] : []),
                            ...(guards.canChangeMethod ? [{ value: 'method', label: 'Change Payment Method' }] : []),
                            ...(guards.canRemoveItem ? [{ value: 'remove-item', label: 'Remove Item (click × on item above first)' }] : []),
                            ...(guards.canAdjustTotal ? [{ value: 'adjust-total', label: 'Adjust Order Total' }] : []),
                            ...(guards.canForceReady ? [{ value: 'force-ready', label: 'Force Order → READY' }] : []),
                            ...(guards.canRevertAuth ? [{ value: 'revert-auth', label: 'Revert AWAITING_AUTH → READY' }] : []),
                            ...(guards.hasRevertibleTickets ? [{ value: 'revert-ticket', label: 'Revert Rejected Ticket → PENDING' }] : []),
                          ]}
                          className="w-full text-sm mb-3"
                        />

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
                            onSubmit={onSubmit}
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
                            onSubmit={onSubmit}
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
                            onSubmit={onSubmit}
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
                            onSubmit={onSubmit}
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
                            onSubmit={onSubmit}
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
                            onSubmit={onSubmit}
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
                            onSubmit={onSubmit}
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

              {activeTab === 'audit' && (
                <div>
                  {auditLog.length === 0 ? (
                    <EmptyState
                      icon={<History size={28} className="text-stone-300" />}
                      heading="No corrections yet"
                      body="Corrections applied to this order will appear here."
                    />
                  ) : (
                    <div className="p-3.5 flex flex-col gap-0">
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

            {/* Footer */}
            <div className="px-3.5 py-2 border-t border-stone-200 bg-stone-50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-red-600">
                <Shield size={11} />
                {locked ? 'Locked — older than 7 days' : 'Corrections locked after 7 days'}
              </div>
              <div className="text-[10.5px] text-stone-400">All changes audited</div>
            </div>
          </>
        )}
      </div>
    </>
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
}: CorrectionFormProps): JSX.Element {
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
