'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Pencil, DollarSign } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  PriceDisplay,
  SkeletonTable,
  Table,
  Toggle,
  type TableColumn,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import {
  houseAccountService,
  type HouseAccount,
  type CreateHouseAccountInput,
  type UpdateHouseAccountInput,
  type RecordHouseSettlementInput,
} from '@/services/houseAccountService';
import { staffService } from '@/services/staffService';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';

interface AccountFormState {
  userId: string;
  creditLimit: string;
  isActive: boolean;
}

interface SettlementFormState {
  amount: string;
  note: string;
}

type AccountRow = Record<string, unknown> & {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  creditLimit: string | null;
  currentBalance: string;
  isActive: boolean;
};

const defaultAccountForm: AccountFormState = {
  userId: '',
  creditLimit: '',
  isActive: true,
};

const defaultSettlementForm: SettlementFormState = {
  amount: '',
  note: '',
};

export default function HouseAccountsPage(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const isReadOnly = role === 'ACCOUNTANT';

  useEffect(() => {
    if (!env.creditAccounts) router.replace('/app/admin');
  }, [router]);

  const [accounts, setAccounts] = useState<HouseAccount[]>([]);
  const [eligibleStaff, setEligibleStaff] = useState<{ id: string; name: string; role: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<AccountFormState>(defaultAccountForm);

  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState<AccountRow | null>(null);
  const [settlementForm, setSettlementForm] = useState<SettlementFormState>(defaultSettlementForm);
  const [isSettling, setIsSettling] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<AccountRow | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const loadData = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [accountList, staff] = await Promise.all([
        houseAccountService.list(accessToken),
        staffService.listStaff(accessToken, { isActive: true }),
      ]);
      setAccounts(accountList);
      // Only show MANAGER and DIRECTOR who don't already have an active account
      const existingUserIds = new Set(accountList.filter((a) => a.isActive).map((a) => a.userId));
      setEligibleStaff(
        staff
          .filter((s) => (s.role === 'MANAGER' || s.role === 'DIRECTOR') && !existingUserIds.has(s.id))
          .map((s) => ({ id: s.id, name: s.name, role: s.role })),
      );
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load house accounts.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const tableData = useMemo<AccountRow[]>(
    () =>
      accounts.map((a) => ({
        id: a.id,
        userId: a.userId,
        userName: a.user.name,
        userRole: a.user.role,
        creditLimit: a.creditLimit,
        currentBalance: a.currentBalance,
        isActive: a.isActive,
      })),
    [accounts],
  );

  const openGrantModal = () => {
    setEditingAccount(null);
    setForm(defaultAccountForm);
    setIsModalOpen(true);
  };

  const openEditModal = (account: AccountRow) => {
    setEditingAccount(account);
    setForm({
      userId: account.userId,
      creditLimit: account.creditLimit ?? '',
      isActive: account.isActive,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setIsModalOpen(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) return;

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        const payload: UpdateHouseAccountInput = {
          creditLimit: form.creditLimit.trim() || null,
          isActive: form.isActive,
        };
        const updated = await houseAccountService.updateAccount(editingAccount.id, payload, accessToken);
        setAccounts((current) => current.map((a) => (a.id === updated.id ? updated : a)));
        toast({ variant: 'success', title: 'House account updated' });
      } else {
        if (!form.userId) {
          toast({ variant: 'warning', title: 'Please select a staff member' });
          setIsSubmitting(false);
          return;
        }
        const payload: CreateHouseAccountInput = {
          userId: form.userId,
          creditLimit: form.creditLimit.trim() || null,
        };
        const created = await houseAccountService.grantAccount(payload, accessToken);
        setAccounts((current) => [created, ...current]);
        toast({ variant: 'success', title: 'House account granted' });
      }
      setIsModalOpen(false);
      setEditingAccount(null);
      setForm(defaultAccountForm);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to save house account.';
      toast({ variant: 'error', title: 'Save failed', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openSettlementModal = (account: AccountRow) => {
    setSettlementTarget(account);
    setSettlementForm(defaultSettlementForm);
    setSettlementModalOpen(true);
  };

  const handleRecordSettlement = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken || !settlementTarget) return;

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
      await houseAccountService.recordSettlement(settlementTarget.id, payload, accessToken);
      // Reload to get updated balance
      await loadData();
      toast({ variant: 'success', title: 'Settlement recorded' });
      setSettlementModalOpen(false);
      setSettlementTarget(null);
      setSettlementForm(defaultSettlementForm);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to record settlement.';
      toast({ variant: 'error', title: 'Settlement failed', message });
    } finally {
      setIsSettling(false);
    }
  };

  const handleDeactivate = async (): Promise<void> => {
    if (!accessToken || !deactivateTarget) return;
    setIsDeactivating(true);
    try {
      const updated = await houseAccountService.updateAccount(deactivateTarget.id, { isActive: false }, accessToken);
      setAccounts((current) => current.map((a) => (a.id === updated.id ? updated : a)));
      toast({ variant: 'success', title: 'House account deactivated' });
      setDeactivateTarget(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to deactivate account.';
      toast({ variant: 'error', title: 'Deactivate failed', message });
    } finally {
      setIsDeactivating(false);
    }
  };

  const columns: TableColumn<AccountRow>[] = [
    { key: 'userName', label: 'Name' },
    {
      key: 'userRole',
      label: 'Role',
      render: (value) => (
        <span className="text-body-sm capitalize text-stone-500">{String(value).toLowerCase().replace('_', ' ')}</span>
      ),
    },
    {
      key: 'currentBalance',
      label: 'Balance (KES)',
      render: (value) => <PriceDisplay amount={Number.parseFloat(String(value))} />,
    },
    {
      key: 'creditLimit',
      label: 'Credit Limit',
      render: (value) =>
        value ? (
          <PriceDisplay amount={Number.parseFloat(String(value))} />
        ) : (
          <span className="text-body-sm text-stone-400">Uncapped</span>
        ),
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (value) => (
        <span
          className={
            value
              ? 'inline-flex rounded-full border border-[#86EFAC] bg-[#EDFAF1] px-2 py-0.5 text-label-sm text-[#1A6B3C]'
              : 'inline-flex rounded-full border border-[#D4D4D8] bg-[#F4F4F5] px-2 py-0.5 text-label-sm text-[#71717A]'
          }
        >
          {value ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-[140px]',
      render: (_value, row) => (
        <div className="flex items-center gap-2">
          {!isReadOnly && (
            <IconButton icon={<Pencil size={16} />} label={`Edit ${row.userName}`} size="sm" onClick={() => openEditModal(row)} />
          )}
          {row.isActive && Number.parseFloat(String(row.currentBalance)) > 0 && (
            <IconButton
              icon={<DollarSign size={16} />}
              label={`Settle ${row.userName}`}
              size="sm"
              onClick={() => openSettlementModal(row)}
            />
          )}
          {!isReadOnly && row.isActive && (
            <IconButton
              icon={<span className="text-xs font-semibold">✕</span>}
              label={`Deactivate ${row.userName}`}
              size="sm"
              variant="destructive"
              onClick={() => setDeactivateTarget(row)}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <PageLayout className="animate-fade-up space-y-6">
      <PageHeader
        title="House Accounts"
        titleClassName="font-display text-display-lg font-semibold text-espresso"
        subtitle="Manage staff house accounts and outstanding tabs."
        action={!isReadOnly ? <Button onClick={openGrantModal}>Grant Account</Button> : undefined}
      />

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        {isLoading ? (
          <SkeletonTable columns={6} rows={5} />
        ) : tableData.length === 0 ? (
          <EmptyState
            icon={<CreditCard size={24} />}
            heading="No house accounts yet"
            body="Grant house accounts to managers and directors."
            action={!isReadOnly ? <Button onClick={openGrantModal}>Grant Account</Button> : undefined}
          />
        ) : (
          <Table columns={columns} data={tableData} keyField="id" />
        )}
      </section>

      {/* Grant / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingAccount ? 'Edit House Account' : 'Grant House Account'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="house-account-form" isLoading={isSubmitting}>
              {editingAccount ? 'Save Changes' : 'Grant Account'}
            </Button>
          </div>
        }
      >
        <form id="house-account-form" className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          {!editingAccount && (
            <div>
              <label className="mb-1.5 block text-label-sm font-medium text-stone-700">Staff Member</label>
              <select
                value={form.userId}
                onChange={(e) => setForm((current) => ({ ...current, userId: e.target.value }))}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-body-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-espresso/30"
              >
                <option value="">Select a manager or director…</option>
                {eligibleStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role.toLowerCase()})
                  </option>
                ))}
              </select>
            </div>
          )}
          {editingAccount && (
            <p className="text-body-sm text-stone-500">
              Account holder: <span className="font-medium text-stone-800">{editingAccount.userName}</span>
            </p>
          )}
          <Input
            label="Credit Limit (KES) — leave blank for uncapped"
            type="number"
            min="0"
            step="0.01"
            value={form.creditLimit}
            onChange={(event) => setForm((current) => ({ ...current, creditLimit: event.target.value }))}
            placeholder="e.g. 5000.00 (optional)"
            disabled={isSubmitting}
          />
          {editingAccount && (
            <div className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
              <Toggle
                checked={form.isActive}
                onChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
                label={form.isActive ? 'Account is active' : 'Account is inactive'}
                disabled={isSubmitting}
              />
            </div>
          )}
        </form>
      </Modal>

      {/* Settlement Modal */}
      <Modal
        isOpen={settlementModalOpen}
        onClose={() => {
          if (!isSettling) {
            setSettlementModalOpen(false);
            setSettlementTarget(null);
          }
        }}
        title={`Record Settlement — ${settlementTarget?.userName ?? ''}`}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setSettlementModalOpen(false);
                setSettlementTarget(null);
              }}
              disabled={isSettling}
            >
              Cancel
            </Button>
            <Button type="submit" form="settlement-form" isLoading={isSettling}>
              Record Settlement
            </Button>
          </div>
        }
      >
        <form id="settlement-form" className="space-y-4" onSubmit={(event) => void handleRecordSettlement(event)}>
          {settlementTarget && (
            <p className="text-body-sm text-stone-500">
              Current balance:{' '}
              <span className="font-semibold text-stone-800">
                KES {Number.parseFloat(String(settlementTarget.currentBalance)).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
              </span>
            </p>
          )}
          <Input
            label="Amount (KES)"
            type="number"
            min="0.01"
            step="0.01"
            value={settlementForm.amount}
            onChange={(event) => setSettlementForm((current) => ({ ...current, amount: event.target.value }))}
            placeholder="e.g. 1500.00"
            disabled={isSettling}
          />
          <Input
            label="Note (optional)"
            value={settlementForm.note}
            onChange={(event) => setSettlementForm((current) => ({ ...current, note: event.target.value }))}
            placeholder="e.g. Cash payment received"
            disabled={isSettling}
          />
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deactivateTarget)}
        onClose={() => {
          if (!isDeactivating) setDeactivateTarget(null);
        }}
        onConfirm={() => void handleDeactivate()}
        title="Deactivate house account?"
        description={
          deactivateTarget
            ? `This will deactivate ${deactivateTarget.userName}'s house account. Outstanding balance must be settled separately.`
            : 'Deactivate this house account?'
        }
        confirmLabel="Deactivate"
        isLoading={isDeactivating}
      />
    </PageLayout>
  );
}
