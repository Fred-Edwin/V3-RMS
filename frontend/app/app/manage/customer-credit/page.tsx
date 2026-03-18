'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Pencil, DollarSign } from 'lucide-react';
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
  customerCreditService,
  type CustomerCreditAccount,
  type CreateCustomerCreditInput,
  type UpdateCustomerCreditInput,
  type RecordCustomerCreditSettlementInput,
} from '@/services/customerCreditService';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';

interface AccountFormState {
  customerName: string;
  customerPhone: string;
  creditLimit: string;
  notes: string;
  isActive: boolean;
}

interface SettlementFormState {
  amount: string;
  note: string;
}

type AccountRow = Record<string, unknown> & {
  id: string;
  customerName: string;
  customerPhone: string;
  creditLimit: string;
  currentBalance: string;
  notes: string | null;
  isActive: boolean;
};

const defaultAccountForm: AccountFormState = {
  customerName: '',
  customerPhone: '',
  creditLimit: '',
  notes: '',
  isActive: true,
};

const defaultSettlementForm: SettlementFormState = { amount: '', note: '' };

export default function CustomerCreditPage(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!env.creditAccounts) router.replace('/app/manage/dashboard');
  }, [router]);

  const [accounts, setAccounts] = useState<CustomerCreditAccount[]>([]);
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

  const loadAccounts = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const list = await customerCreditService.list(accessToken);
      setAccounts(list as CustomerCreditAccount[]);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load customer credit accounts.';
      toast({ variant: 'error', title: 'Load failed', message });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const tableData = useMemo<AccountRow[]>(
    () =>
      accounts.map((a) => ({
        id: a.id,
        customerName: a.customerName,
        customerPhone: a.customerPhone,
        creditLimit: a.creditLimit,
        currentBalance: a.currentBalance,
        notes: a.notes,
        isActive: a.isActive,
      })),
    [accounts],
  );

  const openCreateModal = () => {
    setEditingAccount(null);
    setForm(defaultAccountForm);
    setIsModalOpen(true);
  };

  const openEditModal = (account: AccountRow) => {
    setEditingAccount(account);
    setForm({
      customerName: account.customerName,
      customerPhone: account.customerPhone,
      creditLimit: account.creditLimit,
      notes: account.notes ?? '',
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

    const customerName = form.customerName.trim();
    const customerPhone = form.customerPhone.trim();
    const creditLimit = form.creditLimit.trim();
    if (!customerName || !customerPhone) {
      toast({ variant: 'warning', title: 'Name and phone are required' });
      return;
    }
    if (!editingAccount && !creditLimit) {
      toast({ variant: 'warning', title: 'Credit limit is required' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        const payload: UpdateCustomerCreditInput = {
          customerName,
          customerPhone,
          creditLimit: creditLimit || undefined,
          notes: form.notes.trim() || null,
          isActive: form.isActive,
        };
        const updated = await customerCreditService.updateAccount(editingAccount.id, payload, accessToken);
        setAccounts((current) => current.map((a) => (a.id === updated.id ? updated : a)));
        toast({ variant: 'success', title: 'Account updated' });
      } else {
        const payload: CreateCustomerCreditInput = {
          customerName,
          customerPhone,
          creditLimit,
          notes: form.notes.trim() || undefined,
        };
        const created = await customerCreditService.createAccount(payload, accessToken);
        setAccounts((current) => [created, ...current]);
        toast({ variant: 'success', title: 'Credit account created' });
      }
      setIsModalOpen(false);
      setEditingAccount(null);
      setForm(defaultAccountForm);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to save account.';
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
      const payload: RecordCustomerCreditSettlementInput = {
        amount,
        note: settlementForm.note.trim() || undefined,
      };
      await customerCreditService.recordSettlement(settlementTarget.id, payload, accessToken);
      await loadAccounts();
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
      const updated = await customerCreditService.updateAccount(deactivateTarget.id, { isActive: false }, accessToken);
      setAccounts((current) => current.map((a) => (a.id === updated.id ? updated : a)));
      toast({ variant: 'success', title: 'Account deactivated' });
      setDeactivateTarget(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to deactivate account.';
      toast({ variant: 'error', title: 'Deactivate failed', message });
    } finally {
      setIsDeactivating(false);
    }
  };

  const columns: TableColumn<AccountRow>[] = [
    { key: 'customerName', label: 'Customer' },
    { key: 'customerPhone', label: 'Phone' },
    {
      key: 'currentBalance',
      label: 'Balance (KES)',
      render: (value) => <PriceDisplay amount={Number.parseFloat(String(value))} />,
    },
    {
      key: 'creditLimit',
      label: 'Credit Limit',
      render: (value) => <PriceDisplay amount={Number.parseFloat(String(value))} />,
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
          <IconButton
            icon={<Pencil size={16} />}
            label={`Edit ${row.customerName}`}
            size="sm"
            onClick={() => openEditModal(row)}
          />
          {row.isActive && Number.parseFloat(String(row.currentBalance)) > 0 && (
            <IconButton
              icon={<DollarSign size={16} />}
              label={`Settle ${row.customerName}`}
              size="sm"
              onClick={() => openSettlementModal(row)}
            />
          )}
          {row.isActive && (
            <IconButton
              icon={<span className="text-xs font-semibold">✕</span>}
              label={`Deactivate ${row.customerName}`}
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
        title="Customer Credit Accounts"
        titleClassName="font-display text-display-lg font-semibold text-espresso"
        subtitle="Manage trusted customer credit accounts and outstanding balances."
        action={<Button onClick={openCreateModal}>Add Account</Button>}
      />

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        {isLoading ? (
          <SkeletonTable columns={6} rows={5} />
        ) : tableData.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            heading="No credit accounts yet"
            body="Add customer credit accounts to allow deferred payments."
            action={<Button onClick={openCreateModal}>Add Account</Button>}
          />
        ) : (
          <Table columns={columns} data={tableData} keyField="id" />
        )}
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingAccount ? 'Edit Credit Account' : 'Add Credit Account'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="customer-credit-form" isLoading={isSubmitting}>
              {editingAccount ? 'Save Changes' : 'Add Account'}
            </Button>
          </div>
        }
      >
        <form id="customer-credit-form" className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <Input
            label="Customer Name"
            value={form.customerName}
            onChange={(e) => setForm((c) => ({ ...c, customerName: e.target.value }))}
            placeholder="e.g. Grace Wanjiku"
            disabled={isSubmitting}
          />
          <Input
            label="Phone Number"
            value={form.customerPhone}
            onChange={(e) => setForm((c) => ({ ...c, customerPhone: e.target.value }))}
            placeholder="e.g. 0712345678"
            disabled={isSubmitting}
          />
          <Input
            label="Credit Limit (KES)"
            type="number"
            min="0.01"
            step="0.01"
            value={form.creditLimit}
            onChange={(e) => setForm((c) => ({ ...c, creditLimit: e.target.value }))}
            placeholder="e.g. 3000.00"
            disabled={isSubmitting}
          />
          <Input
            label="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
            placeholder="e.g. Regular customer, pays end of month"
            disabled={isSubmitting}
          />
          {editingAccount && (
            <div className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
              <Toggle
                checked={form.isActive}
                onChange={(checked) => setForm((c) => ({ ...c, isActive: checked }))}
                label={form.isActive ? 'Account is active' : 'Account is inactive'}
                disabled={isSubmitting}
              />
            </div>
          )}
        </form>
      </Modal>

      <Modal
        isOpen={settlementModalOpen}
        onClose={() => {
          if (!isSettling) {
            setSettlementModalOpen(false);
            setSettlementTarget(null);
          }
        }}
        title={`Record Settlement — ${settlementTarget?.customerName ?? ''}`}
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
            <Button type="submit" form="cust-settlement-form" isLoading={isSettling}>
              Record Settlement
            </Button>
          </div>
        }
      >
        <form id="cust-settlement-form" className="space-y-4" onSubmit={(event) => void handleRecordSettlement(event)}>
          {settlementTarget && (
            <p className="text-body-sm text-stone-500">
              Current balance:{' '}
              <span className="font-semibold text-stone-800">
                KES{' '}
                {Number.parseFloat(String(settlementTarget.currentBalance)).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
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
            placeholder="e.g. 1000.00"
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

      <ConfirmDialog
        isOpen={Boolean(deactivateTarget)}
        onClose={() => {
          if (!isDeactivating) setDeactivateTarget(null);
        }}
        onConfirm={() => void handleDeactivate()}
        title="Deactivate credit account?"
        description={
          deactivateTarget
            ? `This will deactivate ${deactivateTarget.customerName}'s credit account. Outstanding balance must be settled separately.`
            : 'Deactivate this credit account?'
        }
        confirmLabel="Deactivate"
        isLoading={isDeactivating}
      />
    </PageLayout>
  );
}
