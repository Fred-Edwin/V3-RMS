'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Pencil, DollarSign } from 'lucide-react';
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
  corporateAccountService,
  type CorporateAccount,
  type CreateCorporateAccountInput,
  type UpdateCorporateAccountInput,
  type RecordCorporateSettlementInput,
} from '@/services/corporateAccountService';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';

interface AccountFormState {
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  creditLimit: string;
  billingCycleDay: string;
  isActive: boolean;
}

interface SettlementFormState {
  amount: string;
  note: string;
}

type AccountRow = Record<string, unknown> & {
  id: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  creditLimit: string | null;
  currentBalance: string;
  billingCycleDay: number;
  isActive: boolean;
};

const defaultAccountForm: AccountFormState = {
  companyName: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  creditLimit: '',
  billingCycleDay: '1',
  isActive: true,
};

const defaultSettlementForm: SettlementFormState = { amount: '', note: '' };

export default function CorporateAccountsPage(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const isReadOnly = role === 'ACCOUNTANT';

  useEffect(() => {
    if (!env.creditAccounts) router.replace('/app/admin');
  }, [router]);

  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
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
      const list = await corporateAccountService.list(accessToken);
      setAccounts(list as CorporateAccount[]);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load corporate accounts.';
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
        companyName: a.companyName,
        contactName: a.contactName,
        contactPhone: a.contactPhone,
        creditLimit: a.creditLimit,
        currentBalance: a.currentBalance,
        billingCycleDay: a.billingCycleDay,
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
      companyName: account.companyName,
      contactName: account.contactName,
      contactPhone: account.contactPhone,
      contactEmail: accounts.find((a) => a.id === account.id)?.contactEmail ?? '',
      creditLimit: account.creditLimit ?? '',
      billingCycleDay: String(account.billingCycleDay),
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

    const companyName = form.companyName.trim();
    const contactName = form.contactName.trim();
    const contactPhone = form.contactPhone.trim();
    if (!companyName || !contactName || !contactPhone) {
      toast({ variant: 'warning', title: 'Company name, contact name and phone are required' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingAccount) {
        const payload: UpdateCorporateAccountInput = {
          companyName,
          contactName,
          contactPhone,
          contactEmail: form.contactEmail.trim() || null,
          creditLimit: form.creditLimit.trim() || null,
          billingCycleDay: Number(form.billingCycleDay),
          isActive: form.isActive,
        };
        const updated = await corporateAccountService.updateAccount(editingAccount.id, payload, accessToken);
        setAccounts((current) => current.map((a) => (a.id === updated.id ? updated : a)));
        toast({ variant: 'success', title: 'Corporate account updated' });
      } else {
        const payload: CreateCorporateAccountInput = {
          companyName,
          contactName,
          contactPhone,
          contactEmail: form.contactEmail.trim() || undefined,
          creditLimit: form.creditLimit.trim() || undefined,
          billingCycleDay: Number(form.billingCycleDay),
        };
        const created = await corporateAccountService.createAccount(payload, accessToken);
        setAccounts((current) => [created, ...current]);
        toast({ variant: 'success', title: 'Corporate account created' });
      }
      setIsModalOpen(false);
      setEditingAccount(null);
      setForm(defaultAccountForm);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to save corporate account.';
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
      const payload: RecordCorporateSettlementInput = {
        amount,
        note: settlementForm.note.trim() || undefined,
      };
      await corporateAccountService.recordSettlement(settlementTarget.id, payload, accessToken);
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
      const updated = await corporateAccountService.updateAccount(deactivateTarget.id, { isActive: false }, accessToken);
      setAccounts((current) => current.map((a) => (a.id === updated.id ? updated : a)));
      toast({ variant: 'success', title: 'Corporate account deactivated' });
      setDeactivateTarget(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to deactivate account.';
      toast({ variant: 'error', title: 'Deactivate failed', message });
    } finally {
      setIsDeactivating(false);
    }
  };

  const columns: TableColumn<AccountRow>[] = [
    { key: 'companyName', label: 'Company' },
    { key: 'contactName', label: 'Contact' },
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
      key: 'billingCycleDay',
      label: 'Billing Day',
      render: (value) => <span className="text-body-sm text-stone-600">Day {String(value)}</span>,
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
            <IconButton icon={<Pencil size={16} />} label={`Edit ${row.companyName}`} size="sm" onClick={() => openEditModal(row)} />
          )}
          {row.isActive && Number.parseFloat(String(row.currentBalance)) > 0 && (
            <IconButton
              icon={<DollarSign size={16} />}
              label={`Settle ${row.companyName}`}
              size="sm"
              onClick={() => openSettlementModal(row)}
            />
          )}
          {!isReadOnly && row.isActive && (
            <IconButton
              icon={<span className="text-xs font-semibold">✕</span>}
              label={`Deactivate ${row.companyName}`}
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
        title="Corporate Accounts"
        titleClassName="font-display text-display-lg font-semibold text-espresso"
        subtitle="Manage partner company accounts and monthly billing."
        action={!isReadOnly ? <Button onClick={openCreateModal}>Add Company</Button> : undefined}
      />

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        {isLoading ? (
          <SkeletonTable columns={7} rows={5} />
        ) : tableData.length === 0 ? (
          <EmptyState
            icon={<Building2 size={24} />}
            heading="No corporate accounts yet"
            body="Add partner companies to enable corporate billing."
            action={!isReadOnly ? <Button onClick={openCreateModal}>Add Company</Button> : undefined}
          />
        ) : (
          <Table columns={columns} data={tableData} keyField="id" />
        )}
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingAccount ? 'Edit Corporate Account' : 'Add Corporate Account'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="corporate-account-form" isLoading={isSubmitting}>
              {editingAccount ? 'Save Changes' : 'Add Account'}
            </Button>
          </div>
        }
      >
        <form id="corporate-account-form" className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <Input
            label="Company Name"
            value={form.companyName}
            onChange={(e) => setForm((c) => ({ ...c, companyName: e.target.value }))}
            placeholder="e.g. Safaricom PLC"
            disabled={isSubmitting}
          />
          <Input
            label="Contact Name"
            value={form.contactName}
            onChange={(e) => setForm((c) => ({ ...c, contactName: e.target.value }))}
            placeholder="e.g. John Kamau"
            disabled={isSubmitting}
          />
          <Input
            label="Contact Phone"
            value={form.contactPhone}
            onChange={(e) => setForm((c) => ({ ...c, contactPhone: e.target.value }))}
            placeholder="e.g. 0712345678"
            disabled={isSubmitting}
          />
          <Input
            label="Contact Email (optional)"
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm((c) => ({ ...c, contactEmail: e.target.value }))}
            placeholder="e.g. accounts@company.co.ke"
            disabled={isSubmitting}
          />
          <Input
            label="Credit Limit (KES) — leave blank for uncapped"
            type="number"
            min="0"
            step="0.01"
            value={form.creditLimit}
            onChange={(e) => setForm((c) => ({ ...c, creditLimit: e.target.value }))}
            placeholder="e.g. 50000.00 (optional)"
            disabled={isSubmitting}
          />
          <Input
            label="Billing Cycle Day (1–28)"
            type="number"
            min="1"
            max="28"
            value={form.billingCycleDay}
            onChange={(e) => setForm((c) => ({ ...c, billingCycleDay: e.target.value }))}
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
        title={`Record Settlement — ${settlementTarget?.companyName ?? ''}`}
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
            <Button type="submit" form="corp-settlement-form" isLoading={isSettling}>
              Record Settlement
            </Button>
          </div>
        }
      >
        <form id="corp-settlement-form" className="space-y-4" onSubmit={(event) => void handleRecordSettlement(event)}>
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
            placeholder="e.g. 15000.00"
            disabled={isSettling}
          />
          <Input
            label="Note (optional)"
            value={settlementForm.note}
            onChange={(e) => setSettlementForm((c) => ({ ...c, note: e.target.value }))}
            placeholder="e.g. Bank transfer ref #123"
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
        title="Deactivate corporate account?"
        description={
          deactivateTarget
            ? `This will deactivate ${deactivateTarget.companyName}. Outstanding balance must be settled separately.`
            : 'Deactivate this corporate account?'
        }
        confirmLabel="Deactivate"
        isLoading={isDeactivating}
      />
    </PageLayout>
  );
}
