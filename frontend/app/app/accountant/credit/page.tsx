'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronRight, DollarSign } from 'lucide-react';
import {
  Button,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  Select,
  SkeletonBlock,
  SkeletonTable,
} from '@/components/ui';
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
  type RecordCorporateSettlementInput,
} from '@/services/corporateAccountService';
import {
  customerCreditService,
  type CustomerCreditAccount,
  type RecordCustomerCreditSettlementInput,
} from '@/services/customerCreditService';
import { reportService } from '@/services/reportService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type { OutstandingBalancesReport } from '@/types/report';

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return 'KES 0.00';
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[360px]">
        <thead>
          <tr className="border-b border-stone-100 bg-stone-50/60">
            <th className="px-4 py-2 text-left text-label-sm font-medium text-stone-500">Order #</th>
            <th className="px-4 py-2 text-left text-label-sm font-medium text-stone-500">Date</th>
            <th className="px-4 py-2 text-right text-label-sm font-medium text-stone-500">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-stone-50/40">
              <td className="px-4 py-2.5 text-body-sm font-medium text-stone-700">#{o.dailyNumber}</td>
              <td className="px-4 py-2.5 text-body-sm text-stone-500">{formatDate(o.createdAt)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-body-sm tabular-nums text-stone-900">
                {formatCurrency(o.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
          Current balance:{' '}
          <span className="font-semibold text-stone-800">{formatCurrency(currentBalance)}</span>
        </p>
        <Input
          label="Amount (KES)"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 1500.00"
          disabled={isLoading}
        />
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
                    <p className={`font-mono text-body-sm font-semibold tabular-nums ${balance > 0 ? 'text-[#92650A]' : 'text-stone-400'}`}>
                      {formatCurrency(balance)}
                    </p>
                    <p className="text-caption text-stone-400">
                      Limit: {account.creditLimit ? formatCurrency(account.creditLimit) : 'Uncapped'}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2 pl-2">
                  <span className={`rounded-full px-2 py-0.5 text-label-sm ${account.isActive ? 'bg-[#EDFAF1] text-[#1A6B3C]' : 'bg-stone-100 text-stone-400'}`}>
                    {account.isActive ? 'Active' : 'Inactive'}
                  </span>
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

// ── Corporate Accounts Tab ────────────────────────────────────────────────────

function CorporateAccountsTab({ accessToken }: { accessToken: string }) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Record<string, OrderHistoryOrder[]>>({});
  const [loadingOrders, setLoadingOrders] = useState<string | null>(null);
  const [settlementTarget, setSettlementTarget] = useState<CorporateAccount | null>(null);
  const [isSettling, setIsSettling] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await corporateAccountService.list(accessToken);
      // list() returns full list for ACCOUNTANT (Director/Admin get full objects)
      setAccounts(data as CorporateAccount[]);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load corporate accounts.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => { void load(); }, [load]);

  const toggleExpand = async (account: CorporateAccount) => {
    if (expandedId === account.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(account.id);
    if (!orders[account.id]) {
      setLoadingOrders(account.id);
      try {
        const result = await corporateAccountService.getOrderHistory(account.id, accessToken);
        setOrders((prev) => ({ ...prev, [account.id]: result.orders }));
      } catch {
        toast({ variant: 'error', title: 'Failed to load order history' });
      } finally {
        setLoadingOrders(null);
      }
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
      await corporateAccountService.recordSettlement(settlementTarget.id, payload, accessToken);
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
    return <p className="py-10 text-center text-body-sm text-stone-400">No corporate accounts found.</p>;
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
                    <p className="text-body-sm font-medium text-stone-900">{account.companyName}</p>
                    <p className="text-caption text-stone-400">{account.contactName} · {account.contactPhone}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-body-sm font-semibold tabular-nums ${balance > 0 ? 'text-[#92650A]' : 'text-stone-400'}`}>
                      {formatCurrency(balance)}
                    </p>
                    <p className="text-caption text-stone-400">
                      Limit: {account.creditLimit ? formatCurrency(account.creditLimit) : 'Uncapped'}
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2 pl-2">
                  <span className={`rounded-full px-2 py-0.5 text-label-sm ${account.isActive ? 'bg-[#EDFAF1] text-[#1A6B3C]' : 'bg-stone-100 text-stone-400'}`}>
                    {account.isActive ? 'Active' : 'Inactive'}
                  </span>
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
        title={`Record Settlement — ${settlementTarget?.companyName ?? ''}`}
        currentBalance={settlementTarget?.currentBalance ?? '0'}
        isLoading={isSettling}
        showPaymentMethod
        onClose={() => { if (!isSettling) setSettlementTarget(null); }}
        onSubmit={(amount, note, paymentMethod) => void handleSettle(amount, note, paymentMethod)}
      />
    </>
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
                      <p className={`font-mono text-body-sm font-semibold tabular-nums ${balance > 0 ? 'text-[#92650A]' : 'text-stone-400'}`}>
                        {formatCurrency(balance)}
                      </p>
                      <p className="text-caption text-stone-400">
                        Limit: {formatCurrency(account.creditLimit)}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 pl-2">
                    <span className={`rounded-full px-2 py-0.5 text-label-sm ${account.isActive ? 'bg-[#EDFAF1] text-[#1A6B3C]' : 'bg-stone-100 text-stone-400'}`}>
                      {account.isActive ? 'Active' : 'Inactive'}
                    </span>
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

const TABS: { key: CreditTab; label: string }[] = [
  { key: 'house', label: 'House Accounts' },
  { key: 'corporate', label: 'Corporate Accounts' },
  { key: 'customer', label: 'Customer Credit' },
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
        <div className="flex gap-1 border-b border-stone-100 bg-stone-50/60 p-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-lg px-4 py-2 text-label-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-espresso text-white shadow-sm'
                  : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
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
