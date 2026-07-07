'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, DollarSign } from 'lucide-react';
import { Badge, Button, EmptyState, Input, Modal, PageHeader, PageLayout, PriceDisplay } from '@/components/ui';
import { TabOrderHistoryTable } from '@/components/orders/TabOrderHistoryTable';
import { useToast } from '@/hooks/useToast';
import {
  houseAccountService,
  type HouseAccount,
  type HouseAccountOrder,
  type HouseAccountOrdersPagination,
  type RecordHouseSettlementInput,
} from '@/services/houseAccountService';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';

interface SettlementFormState {
  amount: string;
  note: string;
}

const defaultSettlementForm: SettlementFormState = { amount: '', note: '' };

export default function MyTabPage(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!env.creditAccounts) router.replace('/app/manage/dashboard');
  }, [router]);

  const user = useAuthStore((state) => state.user);

  // Account
  const [account, setAccount] = useState<HouseAccount | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Settlement modal
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const [settlementForm, setSettlementForm] = useState<SettlementFormState>(defaultSettlementForm);
  const [isSettling, setIsSettling] = useState(false);

  // Order history
  const [orders, setOrders] = useState<HouseAccountOrder[]>([]);
  const [pagination, setPagination] = useState<HouseAccountOrdersPagination | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const loadAccount = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const result = await houseAccountService.getOwn(accessToken);
      setAccount(result);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        setAccount(null);
      } else {
        const message = error instanceof ApiError ? error.message : 'Failed to load house account.';
        toast({ variant: 'error', title: 'Load failed', message });
      }
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  const loadOrders = useCallback(async (page: number, date: string): Promise<void> => {
    if (!accessToken) return;
    setOrdersLoading(true);
    try {
      const result = await houseAccountService.getOwnOrderHistory(accessToken, page, 15, date || undefined);
      setOrders(result.orders);
      setPagination(result.pagination);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load order history.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setOrdersLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    void loadOrders(currentPage, selectedDate);
  }, [loadOrders, currentPage, selectedDate]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setCurrentPage(1);
  };

  const handleClearDate = () => {
    setSelectedDate('');
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleRecordSettlement = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken || !account) return;

    const amount = settlementForm.amount.trim();
    if (!amount) {
      toast({ variant: 'warning', title: 'Amount is required' });
      return;
    }

    setIsSettling(true);
    try {
      const payload: RecordHouseSettlementInput = {
        amount,
        note: settlementForm.note.trim() || undefined,
      };
      await houseAccountService.recordSettlement(account.id, payload, accessToken);
      await loadAccount();
      toast({ variant: 'success', title: 'Settlement recorded' });
      setSettlementModalOpen(false);
      setSettlementForm(defaultSettlementForm);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to record settlement.';
      toast({ variant: 'error', title: 'Settlement failed', message });
    } finally {
      setIsSettling(false);
    }
  };

  const balance = account ? Number.parseFloat(account.currentBalance) : 0;
  const limit = account?.creditLimit ? Number.parseFloat(account.creditLimit) : null;
  const usedPercent = limit && limit > 0 ? Math.min((balance / limit) * 100, 100) : null;

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="My Tab"
        titleClassName="font-display text-display-lg font-semibold text-espresso"
        subtitle="Your house account balance and order history."
      />

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-stone-100" />
      ) : !account ? (
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <EmptyState
            icon={<CreditCard size={24} />}
            heading="No house account"
            body="You don't have a house account yet. Contact a System Admin or Director to get one set up."
          />
        </section>
      ) : (
        <>
          {/* ── Balance Card ── */}
          <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-label-sm text-stone-500">Account Holder</p>
                <p className="mt-0.5 text-body-lg font-semibold text-stone-800">{user?.name ?? account.user.name}</p>
              </div>
              <Badge tone={account.isActive ? 'success' : 'neutral'}>
                {account.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
              <div>
                <p className="text-label-sm text-stone-500">Current Balance</p>
                <p className="mt-0.5 text-display-sm font-bold text-espresso">
                  <PriceDisplay amount={balance} />
                </p>
              </div>
              <div>
                <p className="text-label-sm text-stone-500">Credit Limit</p>
                <p className="mt-0.5 text-display-sm font-bold text-stone-700">
                  {limit ? <PriceDisplay amount={limit} /> : <span className="text-stone-400">Uncapped</span>}
                </p>
              </div>
              {limit && (
                <div>
                  <p className="text-label-sm text-stone-500">Used</p>
                  <p className="mt-0.5 text-display-sm font-bold text-stone-700">{usedPercent?.toFixed(0)}%</p>
                </div>
              )}
            </div>

            {limit && usedPercent !== null && (
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full transition-all ${usedPercent >= 90 ? 'bg-danger' : usedPercent >= 70 ? 'bg-warning' : 'bg-success'}`}
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
              </div>
            )}

            {account.isActive && balance > 0 && (
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={() => {
                    setSettlementForm(defaultSettlementForm);
                    setSettlementModalOpen(true);
                  }}
                >
                  <DollarSign size={16} className="mr-1.5" />
                  Record Settlement
                </Button>
              </div>
            )}
          </section>

          {/* ── Order History Table ── */}
          <TabOrderHistoryTable
            orders={orders}
            pagination={pagination}
            isLoading={ordersLoading}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            onClearDate={handleClearDate}
            onPageChange={handlePageChange}
          />
        </>
      )}

      <Modal
        isOpen={settlementModalOpen}
        onClose={() => {
          if (!isSettling) {
            setSettlementModalOpen(false);
            setSettlementForm(defaultSettlementForm);
          }
        }}
        title="Record Settlement"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setSettlementModalOpen(false);
                setSettlementForm(defaultSettlementForm);
              }}
              disabled={isSettling}
            >
              Cancel
            </Button>
            <Button type="submit" form="my-tab-settlement-form" isLoading={isSettling}>
              Record Settlement
            </Button>
          </div>
        }
      >
        <form id="my-tab-settlement-form" className="space-y-4" onSubmit={(event) => void handleRecordSettlement(event)}>
          {account && (
            <p className="text-body-sm text-stone-500">
              Current balance:{' '}
              <span className="font-semibold text-stone-800">
                KES {balance.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
              </span>
            </p>
          )}
          <Input
            label="Amount (KES)"
            type="number"
            min="0.01"
            step="0.01"
            value={settlementForm.amount}
            onChange={(e) => setSettlementForm((c) => ({ ...c, amount: e.target.value }))}
            placeholder="e.g. 2000.00"
            disabled={isSettling}
          />
          <Input
            label="Note (optional)"
            value={settlementForm.note}
            onChange={(e) => setSettlementForm((c) => ({ ...c, note: e.target.value }))}
            placeholder="e.g. Cash payment"
            disabled={isSettling}
          />
        </form>
      </Modal>
    </PageLayout>
  );
}
