'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronRight, DollarSign, FileText, Loader2, Printer } from 'lucide-react';
import {
  Badge,
  Button,
  ExcelTable,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  Select,
  SkeletonBlock,
  SkeletonTable,
  TabBar,
} from '@/components/ui';
import { PrintTargetModal } from '@/components/orders/PrintTargetModal';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import {
  houseAccountService,
  type HouseAccount,
  type RecordHouseSettlementInput,
} from '@/services/houseAccountService';
import {
  corporateAccountService,
  type CorporateAccount,
  type CorporateAccountOrder,
  type CorporateAccountSettlementRecord,
  type RecordCorporateSettlementInput,
} from '@/services/corporateAccountService';
import {
  customerCreditService,
  type CustomerCreditAccount,
  type RecordCustomerCreditSettlementInput,
} from '@/services/customerCreditService';
import { orderService } from '@/services/orderService';
import { printService } from '@/services/printService';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { OrderDetail } from '@/types/order';
import type { OutstandingBalancesReport } from '@/types/report';

// ── Helpers ────────────────────────────────────────────────────────────────────

// Statement export is still being redesigned to match invoice-standard conventions
// (opening/closing balance, statement ref, payment terms) — hidden until that lands.
const STATEMENT_EXPORT_ENABLED = false;

const toYmd = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return 'KES 0.00';
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

const PAYMENT_LABELS: Record<string, string> = { MPESA: 'M-Pesa', CASH: 'Cash', CARD: 'Card' };

/** Corporate balances can go negative when a company overpays — that's credit owed to them, not a debt. */
const balanceMeta = (balance: number): { label: string; className: string } => {
  if (balance > 0) return { label: formatCurrency(balance), className: 'text-warning' };
  if (balance < 0) return { label: `${formatCurrency(Math.abs(balance))} credit`, className: 'text-success' };
  return { label: formatCurrency(0), className: 'text-stone-400' };
};

type CreditTab = 'house' | 'corporate' | 'customer';

// ── Order History Panel ───────────────────────────────────────────────────────

interface OrderHistoryOrder {
  id: string;
  dailyNumber: number;
  total: string;
  createdAt: string;
  organizationId: string;
}

function OrderHistoryPanel({
  orders,
  isLoading,
}: {
  orders: OrderHistoryOrder[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 px-4 py-3">
        {[1, 2, 3].map((i) => (
          <SkeletonBlock key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    );
  }
  if (orders.length === 0) {
    return <p className="px-4 py-4 text-center text-body-sm text-stone-400">No orders on this account.</p>;
  }
  return (
    <ExcelTable
      columns={[
        { key: 'orderNo', label: 'Order #', render: (o) => <span className="font-medium">#{o.dailyNumber}</span> },
        { key: 'date', label: 'Date', render: (o) => formatDate(o.createdAt) },
        { key: 'amount', label: 'Amount', numeric: true, render: (o) => formatCurrency(o.total) },
      ]}
      rows={orders}
      rowKey={(o) => o.id}
      headerTone="gray"
    />
  );
}

// ── Settlement Modal ──────────────────────────────────────────────────────────

interface SettlementModalProps {
  isOpen: boolean;
  title: string;
  currentBalance: string;
  isLoading: boolean;
  showPaymentMethod?: boolean;
  onClose: () => void;
  onSubmit: (amount: string, note: string, paymentMethod?: string) => void;
}

function SettlementModal({
  isOpen,
  title,
  currentBalance,
  isLoading,
  showPaymentMethod = false,
  onClose,
  onSubmit,
}: SettlementModalProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('MPESA');

  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setNote('');
      setPaymentMethod('MPESA');
    }
  }, [isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(amount, note, showPaymentMethod ? paymentMethod : undefined);
  };

  const balance = Number.parseFloat(currentBalance) || 0;
  const parsedAmount = Number.parseFloat(amount);
  const hasValidAmount = amount !== '' && !Number.isNaN(parsedAmount) && parsedAmount > 0;
  const resultingBalance = hasValidAmount ? balance - parsedAmount : balance;
  const resultingMeta = balanceMeta(resultingBalance);
  const balanceLabel = balanceMeta(balance);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" form="settlement-form" isLoading={isLoading}>Record Settlement</Button>
        </div>
      }
    >
      <form id="settlement-form" className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-body-sm text-stone-500">
          {balance < 0 ? 'Current credit' : 'Current balance'}:{' '}
          <span className={`font-semibold ${balanceLabel.className}`}>{balanceLabel.label}</span>
        </p>
        <div>
          <div className="flex items-end justify-between gap-2">
            <label className="text-label-sm font-medium text-stone-700">Amount (KES)</label>
            {balance > 0 && (
              <button
                type="button"
                onClick={() => setAmount(balance.toFixed(2))}
                disabled={isLoading}
                className="text-label-sm font-medium text-espresso underline-offset-2 hover:underline disabled:opacity-40"
              >
                Pay full balance
              </button>
            )}
          </div>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 1500.00"
            disabled={isLoading}
            className="mt-1.5"
          />
          {hasValidAmount && (
            <p className="mt-1.5 text-caption text-stone-500">
              New balance:{' '}
              <span className={`font-semibold ${resultingMeta.className}`}>{resultingMeta.label}</span>
              {resultingBalance < 0 && (showPaymentMethod ? ' (overpayment — recorded as credit)' : ' — amount exceeds balance')}
            </p>
          )}
        </div>
        {showPaymentMethod && (
          <Select
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            disabled={isLoading}
            options={[
              { value: 'MPESA', label: 'M-Pesa' },
              { value: 'CASH', label: 'Cash' },
              { value: 'CARD', label: 'Card' },
            ]}
          />
        )}
        <Input
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Bank transfer ref #12345"
          disabled={isLoading}
        />
      </form>
    </Modal>
  );
}

// ── Outstanding Balance KPI header ───────────────────────────────────────────

function OutstandingHeader({ report, isLoading }: { report: OutstandingBalancesReport | null; isLoading: boolean }) {
  const items = [
    { label: 'Corporate Accounts', value: report?.totals.corporateAccounts ?? '0' },
    { label: 'Customer Credit', value: report?.totals.customerCreditAccounts ?? '0' },
    { label: 'Staff Benefits', value: report?.totals.staffBenefits ?? '0', isBenefit: true },
  ];
  const grandTotal = report?.totals.grandTotal ?? '0';

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-100 px-5 py-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-heading-sm font-semibold text-stone-900">Outstanding Balances</h2>
          {isLoading ? (
            <SkeletonBlock className="h-5 w-28 rounded" />
          ) : (
            <span className="font-sans text-display-lg font-semibold tabular-nums text-espresso">
              {formatCurrency(grandTotal)}
            </span>
          )}
        </div>
        <p className="text-caption text-stone-400">Accounts receivable (Corporate + Customer Credit). Staff benefits tracked separately.</p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-stone-100">
        {items.map(({ label, value }) => (
          <div key={label} className="px-4 py-3">
            <p className="text-label-sm text-stone-500">{label}</p>
            {isLoading ? (
              <SkeletonBlock className="mt-1 h-5 w-24 rounded" />
            ) : (
              <p className="mt-0.5 font-mono text-body-sm font-semibold tabular-nums text-stone-900">
                {formatCurrency(value)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── House Accounts Tab ────────────────────────────────────────────────────────

function HouseAccountsTab({ accessToken }: { accessToken: string }) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<HouseAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Record<string, OrderHistoryOrder[]>>({});
  const [loadingOrders, setLoadingOrders] = useState<string | null>(null);
  const [settlementTarget, setSettlementTarget] = useState<HouseAccount | null>(null);
  const [isSettling, setIsSettling] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await houseAccountService.list(accessToken);
      setAccounts(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load house accounts.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => { void load(); }, [load]);

  const toggleExpand = async (account: HouseAccount) => {
    if (expandedId === account.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(account.id);
    if (!orders[account.id]) {
      setLoadingOrders(account.id);
      try {
        const result = await houseAccountService.getOrderHistory(account.id, accessToken);
        setOrders((prev) => ({ ...prev, [account.id]: result.orders }));
      } catch {
        toast({ variant: 'error', title: 'Failed to load order history' });
      } finally {
        setLoadingOrders(null);
      }
    }
  };

  const handleSettle = async (amount: string, note: string) => {
    if (!settlementTarget || !amount) return;
    setIsSettling(true);
    try {
      const payload: RecordHouseSettlementInput = { amount, note: note || undefined };
      await houseAccountService.recordSettlement(settlementTarget.id, payload, accessToken);
      toast({ variant: 'success', title: 'Settlement recorded' });
      setSettlementTarget(null);
      await load();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to record settlement.';
      toast({ variant: 'error', title: 'Settlement failed', message });
    } finally {
      setIsSettling(false);
    }
  };

  if (isLoading) return <SkeletonTable rows={4} columns={4} />;
  if (accounts.length === 0) {
    return <p className="py-10 text-center text-body-sm text-stone-400">No house accounts found.</p>;
  }

  return (
    <>
      <div className="divide-y divide-stone-100">
        {accounts.map((account) => {
          const balance = Number.parseFloat(account.currentBalance);
          const isExpanded = expandedId === account.id;
          return (
            <div key={account.id}>
              <div className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-stone-50/60">
                <button
                  onClick={() => void toggleExpand(account)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown size={16} className="shrink-0 text-stone-400" />
                  ) : (
                    <ChevronRight size={16} className="shrink-0 text-stone-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-medium text-stone-900">{account.user.name}</p>
                    <p className="text-caption capitalize text-stone-400">
                      {account.user.role.toLowerCase().replace('_', ' ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-body-sm font-semibold tabular-nums ${balance > 0 ? 'text-warning' : 'text-stone-400'}`}>
                      {formatCurrency(balance)}
                    </p>
                    <p className="text-caption text-stone-400">
                      Limit: {account.creditLimit ? formatCurrency(account.creditLimit) : 'Uncapped'}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2 pl-2">
                  <Badge tone={account.isActive ? 'success' : 'neutral'}>
                    {account.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {account.isActive && balance > 0 && (
                    <IconButton
                      icon={<DollarSign size={15} />}
                      label="Record settlement"
                      size="sm"
                      onClick={() => setSettlementTarget(account)}
                    />
                  )}
                </div>
              </div>
              {isExpanded && (
                <div className="border-t border-stone-100 bg-stone-50/40 pb-2">
                  <p className="px-5 py-2 text-label-sm font-medium text-stone-500">Order History</p>
                  <OrderHistoryPanel
                    orders={orders[account.id] ?? []}
                    isLoading={loadingOrders === account.id}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <SettlementModal
        isOpen={Boolean(settlementTarget)}
        title={`Record Settlement — ${settlementTarget?.user.name ?? ''}`}
        currentBalance={settlementTarget?.currentBalance ?? '0'}
        isLoading={isSettling}
        onClose={() => { if (!isSettling) setSettlementTarget(null); }}
        onSubmit={(amount, note) => void handleSettle(amount, note)}
      />
    </>
  );
}

// ── Corporate Accounts Tab (master-detail) ─────────────────────────────────────

type CorporateDetailTab = 'orders' | 'settlements';

function CorporateOrderRow({
  order,
  accessToken,
  isExpanded,
  onToggle,
}: {
  order: CorporateAccountOrder;
  accessToken: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    onToggle();
    if (!isExpanded && !detail) {
      setIsLoading(true);
      try {
        const data = await orderService.getById(order.id, accessToken, order.organizationId);
        setDetail(data);
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Unable to load order details.';
        toast({ variant: 'error', title: 'Load failed', message });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <>
      <tr
        onClick={() => void handleClick()}
        className={`cursor-pointer transition-colors ${isExpanded ? 'bg-amber-50/60' : 'hover:bg-stone-50/60'}`}
      >
        <td className="border border-sheet-grid px-3 py-2 text-stone-400">
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="border border-sheet-grid px-2.5 py-2 font-medium text-office-ink">#{order.dailyNumber}</td>
        <td className="border border-sheet-grid px-2.5 py-2 text-office-ink">{formatDate(order.createdAt)}</td>
        <td className="border border-sheet-grid px-2.5 py-2 text-office-ink">{order.corporateEmployeeRef ?? '—'}</td>
        <td className="border border-sheet-grid px-2.5 py-2 text-right font-semibold tabular-nums text-office-ink">{formatCurrency(order.total)}</td>
      </tr>
      {isExpanded && detail && (
        <tr className="bg-amber-50/30">
          <td colSpan={5} className="border border-sheet-grid px-6 pb-4 pt-2">
            <div className="rounded-lg border border-amber-100 bg-white shadow-sm">
              <ExcelTable
                columns={[
                  {
                    key: 'item',
                    label: 'Item',
                    render: (item) => (
                      <>
                        {item.name}
                        {item.notes && <span className="ml-1.5 text-caption text-stone-400">({item.notes})</span>}
                      </>
                    ),
                  },
                  { key: 'qty', label: 'Qty', align: 'center', render: (item) => item.quantity },
                  { key: 'unitPrice', label: 'Unit Price', numeric: true, render: (item) => formatCurrency(item.unitPrice) },
                  { key: 'subtotal', label: 'Subtotal', numeric: true, render: (item) => <span className="font-medium">{formatCurrency(item.subtotal)}</span> },
                ]}
                rows={detail.items}
                rowKey={(item) => item.id}
                headerTone="gray"
                totalsRow={{
                  item: <span className="text-label-sm uppercase tracking-wide">Total</span>,
                  subtotal: <span className="font-bold text-espresso">{formatCurrency(detail.total)}</span>,
                }}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CorporateOrdersPanel({ orders, accessToken, isLoading }: { orders: CorporateAccountOrder[]; accessToken: string; isLoading: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <SkeletonTable rows={4} columns={5} />;
  if (orders.length === 0) {
    return <p className="px-4 py-8 text-center text-body-sm text-stone-400">No orders on this account.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-sheet-grid">
      <table className="w-full border-collapse font-sheet text-sheet-base">
        <thead>
          <tr className="bg-sheet-band-navy text-white">
            <th className="w-8 border border-sheet-grid px-2 py-1.5" />
            <th className="border border-sheet-grid px-2.5 py-1.5 text-left font-bold">Order #</th>
            <th className="border border-sheet-grid px-2.5 py-1.5 text-left font-bold">Date</th>
            <th className="border border-sheet-grid px-2.5 py-1.5 text-left font-bold">Employee</th>
            <th className="border border-sheet-grid px-2.5 py-1.5 text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <CorporateOrderRow
              key={order.id}
              order={order}
              accessToken={accessToken}
              isExpanded={expandedId === order.id}
              onToggle={() => setExpandedId((prev) => (prev === order.id ? null : order.id))}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CorporateSettlementsPanel({ settlements, isLoading }: { settlements: CorporateAccountSettlementRecord[]; isLoading: boolean }) {
  if (isLoading) return <SkeletonTable rows={4} columns={4} />;
  if (settlements.length === 0) {
    return <p className="px-4 py-8 text-center text-body-sm text-stone-400">No settlements recorded yet.</p>;
  }
  return (
    <ExcelTable
      columns={[
        { key: 'date', label: 'Date', render: (s) => formatDateTime(s.createdAt) },
        { key: 'amount', label: 'Amount', numeric: true, render: (s) => <span className="font-semibold text-success">{formatCurrency(s.amount)}</span> },
        { key: 'method', label: 'Method', render: (s) => PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod },
        { key: 'settledBy', label: 'Recorded By', render: (s) => s.settledBy.name },
        { key: 'note', label: 'Note', render: (s) => <span className="italic text-stone-500">{s.note ?? '—'}</span> },
      ]}
      rows={settlements}
      rowKey={(s) => s.id}
      headerTone="gray"
    />
  );
}

function CorporateAccountDetail({
  account,
  accessToken,
  onSettled,
}: {
  account: CorporateAccount;
  accessToken: string;
  onSettled: () => void;
}) {
  const { toast } = useToast();
  const [detailTab, setDetailTab] = useState<CorporateDetailTab>('orders');
  const [orders, setOrders] = useState<CorporateAccountOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [settlements, setSettlements] = useState<CorporateAccountSettlementRecord[]>([]);
  const [isLoadingSettlements, setIsLoadingSettlements] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState<CorporateAccount | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [settledReceipt, setSettledReceipt] = useState<{ settlementId: string; companyName: string } | null>(null);
  const [printTargetModalOpen, setPrintTargetModalOpen] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [rangeStartDate, setRangeStartDate] = useState('');
  const [rangeEndDate, setRangeEndDate] = useState('');
  const [isExportingStatement, setIsExportingStatement] = useState(false);
  const hasDateRange = Boolean(rangeStartDate && rangeEndDate);

  const loadOrders = useCallback(async () => {
    if (!hasDateRange) {
      setOrders([]);
      return;
    }
    setIsLoadingOrders(true);
    try {
      const result = await corporateAccountService.getOrderHistory(account.id, accessToken, 1, 100, {
        startDate: rangeStartDate,
        endDate: rangeEndDate,
      });
      setOrders(result.orders);
    } catch {
      toast({ variant: 'error', title: 'Failed to load order history' });
    } finally {
      setIsLoadingOrders(false);
    }
  }, [account.id, accessToken, hasDateRange, rangeStartDate, rangeEndDate, toast]);

  const loadSettlements = useCallback(async () => {
    if (!hasDateRange) {
      setSettlements([]);
      return;
    }
    setIsLoadingSettlements(true);
    try {
      const result = await corporateAccountService.getSettlementHistory(account.id, accessToken, 1, 100, {
        startDate: rangeStartDate,
        endDate: rangeEndDate,
      });
      setSettlements(result.settlements);
    } catch {
      toast({ variant: 'error', title: 'Failed to load settlement history' });
    } finally {
      setIsLoadingSettlements(false);
    }
  }, [account.id, accessToken, hasDateRange, rangeStartDate, rangeEndDate, toast]);

  useEffect(() => {
    void loadOrders();
    void loadSettlements();
  }, [loadOrders, loadSettlements]);

  const handleExportStatement = async () => {
    if (!hasDateRange) return;
    setIsExportingStatement(true);
    try {
      await reportService.exportReport(accessToken, {
        reportType: 'corporate_account_statement',
        format: 'pdf',
        startDate: rangeStartDate,
        endDate: rangeEndDate,
        corporateAccountId: account.id,
      });
      toast({ variant: 'success', title: 'Statement download started' });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not generate statement PDF.';
      toast({ variant: 'error', title: 'Export failed', message });
    } finally {
      setIsExportingStatement(false);
    }
  };

  const handleSettle = async (amount: string, note: string, paymentMethod?: string) => {
    if (!settlementTarget || !amount || !paymentMethod) return;
    setIsSettling(true);
    try {
      const payload: RecordCorporateSettlementInput = {
        amount,
        paymentMethod: paymentMethod as 'MPESA' | 'CASH' | 'CARD',
        note: note || undefined,
      };
      const result = await corporateAccountService.recordSettlement(settlementTarget.id, payload, accessToken);
      toast({ variant: 'success', title: 'Settlement recorded' });
      setSettledReceipt({ settlementId: result.settlementId, companyName: settlementTarget.companyName });
      setSettlementTarget(null);
      await loadSettlements();
      onSettled();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to record settlement.';
      toast({ variant: 'error', title: 'Settlement failed', message });
    } finally {
      setIsSettling(false);
    }
  };

  const handlePrintSettlementReceipt = async (targetStationId: string | null): Promise<void> => {
    if (!settledReceipt) return;
    setIsPrintingReceipt(true);
    try {
      await printService.createCorporateSettlementPrintJob(settledReceipt.settlementId, accessToken, undefined, targetStationId);
      toast({ variant: 'success', title: 'Settlement receipt sent to printer' });
      setPrintTargetModalOpen(false);
      setSettledReceipt(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to print settlement receipt.';
      toast({ variant: 'error', title: 'Print failed', message });
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  const balance = Number.parseFloat(account.currentBalance);
  const meta = balanceMeta(balance);

  return (
    <div className="flex h-full flex-col">
      {/* Header — identity + actions in one row (document-toolbar convention) */}
      <div className="border-b border-stone-100 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-heading-md font-semibold text-stone-900">{account.companyName}</h2>
                <Badge tone={account.isActive ? 'success' : 'neutral'}>{account.isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
              <p className="mt-0.5 text-body-sm text-stone-500">
                {account.contactName} · {account.contactPhone}{account.contactEmail ? ` · ${account.contactEmail}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {STATEMENT_EXPORT_ENABLED && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleExportStatement()}
                disabled={!hasDateRange}
                isLoading={isExportingStatement}
              >
                <FileText size={15} className="mr-1.5" />
                Statement
              </Button>
            )}
            {account.isActive && (
              <Button size="sm" onClick={() => setSettlementTarget(account)}>
                <DollarSign size={15} className="mr-1.5" />
                Record Settlement
              </Button>
            )}
          </div>
        </div>

        {/* Date-range picker — scopes Orders/Settlements tabs and the Statement export */}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-label-sm font-medium text-stone-600">From</label>
            <input
              type="date"
              value={rangeStartDate}
              max={rangeEndDate || toYmd(new Date())}
              onChange={(e) => setRangeStartDate(e.target.value)}
              className="rounded-sm border border-stone-200 bg-white px-3 py-1.5 text-body-sm text-stone-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-label-sm font-medium text-stone-600">To</label>
            <input
              type="date"
              value={rangeEndDate}
              min={rangeStartDate || undefined}
              max={toYmd(new Date())}
              onChange={(e) => setRangeEndDate(e.target.value)}
              className="rounded-sm border border-stone-200 bg-white px-3 py-1.5 text-body-sm text-stone-900 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          {!hasDateRange && (
            <p className="pb-2 text-body-sm text-stone-400">Pick a date range to view orders, settlements, and export a statement.</p>
          )}
        </div>

        {/* Ledger strip — sharp corners, hairline dividers (office data-surface idiom) */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-stone-200 rounded-none border border-stone-200 bg-white">
          <div className="px-4 py-2.5">
            <p className="text-label-sm uppercase tracking-wide text-stone-400">{balance < 0 ? 'Credit Balance' : 'Outstanding'}</p>
            <p className={`mt-0.5 font-mono text-body-md font-semibold tabular-nums ${meta.className}`}>{meta.label}</p>
          </div>
          <div className="px-4 py-2.5">
            <p className="text-label-sm uppercase tracking-wide text-stone-400">Credit Limit</p>
            <p className="mt-0.5 font-mono text-body-md font-semibold tabular-nums text-stone-700">
              {account.creditLimit ? formatCurrency(account.creditLimit) : 'Uncapped'}
            </p>
          </div>
          <div className="px-4 py-2.5">
            <p className="text-label-sm uppercase tracking-wide text-stone-400">Orders in Range</p>
            <p className="mt-0.5 font-mono text-body-md font-semibold tabular-nums text-stone-700">{orders.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-100 px-5 py-2">
        <TabBar
          tabs={[
            { value: 'orders', label: `Orders (${orders.length})` },
            { value: 'settlements', label: `Settlements (${settlements.length})` },
          ]}
          active={detailTab}
          onChange={setDetailTab}
          variant="segmented"
        />
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto p-5">
        {detailTab === 'orders' ? (
          <CorporateOrdersPanel orders={orders} accessToken={accessToken} isLoading={isLoadingOrders} />
        ) : (
          <CorporateSettlementsPanel settlements={settlements} isLoading={isLoadingSettlements} />
        )}
      </div>

      <SettlementModal
        isOpen={Boolean(settlementTarget)}
        title={`Record Settlement — ${settlementTarget?.companyName ?? ''}`}
        currentBalance={settlementTarget?.currentBalance ?? '0'}
        isLoading={isSettling}
        showPaymentMethod
        onClose={() => { if (!isSettling) setSettlementTarget(null); }}
        onSubmit={(amount, note, paymentMethod) => void handleSettle(amount, note, paymentMethod)}
      />

      <Modal
        isOpen={Boolean(settledReceipt)}
        onClose={() => setSettledReceipt(null)}
        title={`Settlement Recorded — ${settledReceipt?.companyName ?? ''}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setSettledReceipt(null)}>Done</Button>
            <Button onClick={() => setPrintTargetModalOpen(true)}>
              <Printer size={16} className="mr-2 shrink-0" />
              Print Receipt
            </Button>
          </div>
        }
      >
        <p className="text-body-sm text-stone-600">
          The settlement was recorded successfully. You can print a thermal receipt as proof of
          payment now, or close this and print it later from the print jobs list.
        </p>
      </Modal>

      <PrintTargetModal
        isOpen={printTargetModalOpen}
        onClose={() => { if (!isPrintingReceipt) setPrintTargetModalOpen(false); }}
        kind="SETTLEMENT"
        isSubmitting={isPrintingReceipt}
        onConfirm={(targetStationId) => void handlePrintSettlementReceipt(targetStationId)}
      />
    </div>
  );
}

function CorporateAccountsTab({ accessToken }: { accessToken: string }) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await corporateAccountService.list(accessToken);
      // list() returns full list for ACCOUNTANT (Director/Admin get full objects)
      const full = data as CorporateAccount[];
      setAccounts(full);
      setSelectedId((prev) => prev ?? full[0]?.id ?? null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load corporate accounts.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => { void load(); }, [load]);

  const filteredAccounts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) => a.companyName.toLowerCase().includes(q) || a.contactName.toLowerCase().includes(q),
    );
  }, [accounts, query]);

  const selectedAccount = accounts.find((a) => a.id === selectedId) ?? null;

  if (isLoading) return <SkeletonTable rows={4} columns={4} />;
  if (accounts.length === 0) {
    return <p className="py-10 text-center text-body-sm text-stone-400">No corporate accounts found.</p>;
  }

  return (
    <div className="flex min-h-[520px] flex-col sm:flex-row">
      {/* Master list */}
      <div className="w-full shrink-0 border-b border-stone-100 sm:w-72 sm:border-b-0 sm:border-r">
        <div className="border-b border-stone-100 p-3">
          <Input
            placeholder="Search company or contact…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[460px] overflow-y-auto sm:max-h-none">
          {filteredAccounts.length === 0 ? (
            <p className="px-4 py-8 text-center text-body-sm text-stone-400">No matches.</p>
          ) : (
            filteredAccounts.map((account) => {
              const balance = Number.parseFloat(account.currentBalance);
              const meta = balanceMeta(balance);
              const isSelected = account.id === selectedId;
              return (
                <button
                  key={account.id}
                  onClick={() => setSelectedId(account.id)}
                  className={`flex w-full flex-col gap-0.5 border-b border-l-2 border-stone-100 px-4 py-3 text-left transition-colors ${
                    isSelected ? 'border-l-espresso bg-stone-50' : 'border-l-transparent hover:bg-stone-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-body-sm font-medium text-stone-900">{account.companyName}</span>
                    {!account.isActive && <Badge tone="neutral">Inactive</Badge>}
                  </div>
                  <span className={`font-mono text-caption font-semibold tabular-nums ${meta.className}`}>{meta.label}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1">
        {selectedAccount ? (
          <CorporateAccountDetail key={selectedAccount.id} account={selectedAccount} accessToken={accessToken} onSettled={() => void load()} />
        ) : (
          <p className="py-10 text-center text-body-sm text-stone-400">Select a company to view details.</p>
        )}
      </div>
    </div>
  );
}

// ── Customer Credit Tab ───────────────────────────────────────────────────────

function CustomerCreditTab({
  accessToken,
  branches,
}: {
  accessToken: string;
  branches: BranchDto[];
}) {
  const { toast } = useToast();
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id ?? '');
  const [accounts, setAccounts] = useState<CustomerCreditAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Record<string, OrderHistoryOrder[]>>({});
  const [loadingOrders, setLoadingOrders] = useState<string | null>(null);
  const [settlementTarget, setSettlementTarget] = useState<CustomerCreditAccount | null>(null);
  const [isSettling, setIsSettling] = useState(false);

  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(branches[0]?.id ?? '');
    }
  }, [branches, selectedBranchId]);

  const load = useCallback(async () => {
    if (!selectedBranchId) return;
    setIsLoading(true);
    setAccounts([]);
    setExpandedId(null);
    try {
      const data = await customerCreditService.list(accessToken, { branchId: selectedBranchId });
      setAccounts(data as CustomerCreditAccount[]);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load customer credit accounts.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedBranchId, toast]);

  useEffect(() => { void load(); }, [load]);

  const toggleExpand = async (account: CustomerCreditAccount) => {
    if (expandedId === account.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(account.id);
    if (!orders[account.id]) {
      setLoadingOrders(account.id);
      try {
        const result = await customerCreditService.getOrderHistory(
          account.id, accessToken, 1, 50, selectedBranchId,
        );
        setOrders((prev) => ({ ...prev, [account.id]: result.orders }));
      } catch {
        toast({ variant: 'error', title: 'Failed to load order history' });
      } finally {
        setLoadingOrders(null);
      }
    }
  };

  const handleSettle = async (amount: string, note: string) => {
    if (!settlementTarget || !amount) return;
    setIsSettling(true);
    try {
      const payload: RecordCustomerCreditSettlementInput = { amount, note: note || undefined };
      await customerCreditService.recordSettlement(
        settlementTarget.id, payload, accessToken, selectedBranchId,
      );
      toast({ variant: 'success', title: 'Settlement recorded' });
      setSettlementTarget(null);
      await load();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to record settlement.';
      toast({ variant: 'error', title: 'Settlement failed', message });
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <>
      {/* Branch selector */}
      <div className="border-b border-stone-100 px-5 py-3">
        <Select
          label="Branch"
          options={branches.map((b) => ({ value: b.id, label: b.name }))}
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
        />
      </div>

      {isLoading ? (
        <SkeletonTable rows={4} columns={4} />
      ) : accounts.length === 0 ? (
        <p className="py-10 text-center text-body-sm text-stone-400">
          {selectedBranchId ? 'No customer credit accounts for this branch.' : 'Select a branch.'}
        </p>
      ) : (
        <div className="divide-y divide-stone-100">
          {accounts.map((account) => {
            const balance = Number.parseFloat(account.currentBalance);
            const isExpanded = expandedId === account.id;
            return (
              <div key={account.id}>
                <div className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-stone-50/60">
                  <button
                    onClick={() => void toggleExpand(account)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown size={16} className="shrink-0 text-stone-400" />
                    ) : (
                      <ChevronRight size={16} className="shrink-0 text-stone-400" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm font-medium text-stone-900">{account.customerName}</p>
                      <p className="text-caption text-stone-400">{account.customerPhone}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-body-sm font-semibold tabular-nums ${balance > 0 ? 'text-warning' : 'text-stone-400'}`}>
                        {formatCurrency(balance)}
                      </p>
                      <p className="text-caption text-stone-400">
                        Limit: {formatCurrency(account.creditLimit)}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 pl-2">
                    <Badge tone={account.isActive ? 'success' : 'neutral'}>
                      {account.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    {account.isActive && balance > 0 && (
                      <IconButton
                        icon={<DollarSign size={15} />}
                        label="Record settlement"
                        size="sm"
                        onClick={() => setSettlementTarget(account)}
                      />
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-stone-100 bg-stone-50/40 pb-2">
                    <p className="px-5 py-2 text-label-sm font-medium text-stone-500">Order History</p>
                    <OrderHistoryPanel
                      orders={orders[account.id] ?? []}
                      isLoading={loadingOrders === account.id}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SettlementModal
        isOpen={Boolean(settlementTarget)}
        title={`Record Settlement — ${settlementTarget?.customerName ?? ''}`}
        currentBalance={settlementTarget?.currentBalance ?? '0'}
        isLoading={isSettling}
        onClose={() => { if (!isSettling) setSettlementTarget(null); }}
        onSubmit={(amount, note) => void handleSettle(amount, note)}
      />
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { value: CreditTab; label: string }[] = [
  { value: 'house', label: 'House Accounts' },
  { value: 'corporate', label: 'Corporate Accounts' },
  { value: 'customer', label: 'Customer Credit' },
];

export default function AccountantCreditPage(): JSX.Element {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [activeTab, setActiveTab] = useState<CreditTab>('house');
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [outstanding, setOutstanding] = useState<OutstandingBalancesReport | null>(null);
  const [isLoadingOutstanding, setIsLoadingOutstanding] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    setIsLoadingOutstanding(true);
    Promise.all([
      branchService.listBranches(accessToken),
      reportService.getOutstandingBalances(accessToken),
    ])
      .then(([branchData, outstandingData]) => {
        setBranches(branchData.filter((b) => b.isActive && !b.isHub));
        setOutstanding(outstandingData);
      })
      .catch(() => {
        toast({ variant: 'error', title: 'Failed to load credit data' });
      })
      .finally(() => setIsLoadingOutstanding(false));
  // accessToken and toast are stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  if (!accessToken) return <></>;

  return (
    <PageLayout className="space-y-6 animate-fade-up">
      <PageHeader
        title="Credit Accounts"
        subtitle="Outstanding balances, order history, and settlement recording"
      />

      {/* Outstanding totals header */}
      <OutstandingHeader report={outstanding} isLoading={isLoadingOutstanding} />

      {/* Tab bar + content */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        {/* Tabs */}
        <div className="border-b border-stone-100 bg-stone-50/60 p-1.5">
          <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} variant="segmented" />
        </div>

        {/* Tab content */}
        {activeTab === 'house' && <HouseAccountsTab accessToken={accessToken} />}
        {activeTab === 'corporate' && <CorporateAccountsTab accessToken={accessToken} />}
        {activeTab === 'customer' && (
          <CustomerCreditTab accessToken={accessToken} branches={branches} />
        )}
      </div>
    </PageLayout>
  );
}
