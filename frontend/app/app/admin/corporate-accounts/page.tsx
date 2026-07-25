'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Pencil, DollarSign, Printer } from 'lucide-react';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ExcelTable,
  IconButton,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  PriceDisplay,
  Select,
  SkeletonTable,
  Toggle,
  type ExcelColumn,
} from '@/components/ui';
import { PrintTargetModal } from '@/components/orders/PrintTargetModal';
import { useToast } from '@/hooks/useToast';
import {
  corporateAccountService,
  type CorporateAccount,
  type CreateCorporateAccountInput,
  type UpdateCorporateAccountInput,
  type RecordCorporateSettlementInput,
} from '@/services/corporateAccountService';
import { printService } from '@/services/printService';
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
  paymentMethod: 'MPESA' | 'CASH' | 'CARD';
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

const defaultSettlementForm: SettlementFormState = { amount: '', paymentMethod: 'MPESA', note: '' };

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
  const [settledResult, setSettledResult] = useState<{ settlementId: string; companyName: string } | null>(null);
  const [printTargetModalOpen, setPrintTargetModalOpen] = useState(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);

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
    setSettledResult(null);
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
        paymentMethod: settlementForm.paymentMethod,
        note: settlementForm.note.trim() || undefined,
      };
      const result = await corporateAccountService.recordSettlement(settlementTarget.id, payload, accessToken);
      await loadAccounts();
      toast({ variant: 'success', title: 'Settlement recorded' });
      setSettledResult({ settlementId: result.settlementId, companyName: settlementTarget.companyName });
      setSettlementForm(defaultSettlementForm);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to record settlement.';
      toast({ variant: 'error', title: 'Settlement failed', message });
    } finally {
      setIsSettling(false);
    }
  };

  const closeSettlementModal = () => {
    setSettlementModalOpen(false);
    setSettlementTarget(null);
    setSettledResult(null);
  };

  const handlePrintSettlementReceipt = async (targetStationId: string | null): Promise<void> => {
    if (!accessToken || !settledResult) return;
    setIsPrintingReceipt(true);
    try {
      await printService.createCorporateSettlementPrintJob(
        settledResult.settlementId,
        accessToken,
        undefined,
        targetStationId,
      );
      toast({ variant: 'success', title: 'Settlement receipt sent to printer' });
      setPrintTargetModalOpen(false);
      closeSettlementModal();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Unable to print settlement receipt.';
      toast({ variant: 'error', title: 'Print failed', message });
    } finally {
      setIsPrintingReceipt(false);
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

  const columns: ExcelColumn<AccountRow>[] = [
    { key: 'companyName', label: 'Company', render: (row) => row.companyName },
    { key: 'contactName', label: 'Contact', render: (row) => row.contactName },
    {
      key: 'currentBalance',
      label: 'Balance (KES)',
      numeric: true,
      render: (row) => <PriceDisplay amount={Number.parseFloat(String(row.currentBalance))} />,
    },
    {
      key: 'creditLimit',
      label: 'Credit Limit',
      numeric: true,
      render: (row) =>
        row.creditLimit ? (
          <PriceDisplay amount={Number.parseFloat(String(row.creditLimit))} />
        ) : (
          <span className="text-body-sm text-stone-400">Uncapped</span>
        ),
    },
    {
      key: 'billingCycleDay',
      label: 'Billing Day',
      render: (row) => <span className="text-body-sm text-stone-600">Day {String(row.billingCycleDay)}</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      render: (row) => <Badge tone={row.isActive ? 'success' : 'neutral'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
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
          <ExcelTable columns={columns} rows={tableData} rowKey={(row) => row.id} headerTone="gray" />
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
          if (!isSettling) closeSettlementModal();
        }}
        title={
          settledResult
            ? `Settlement Recorded — ${settledResult.companyName}`
            : `Record Settlement — ${settlementTarget?.companyName ?? ''}`
        }
        footer={
          settledResult ? (
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={closeSettlementModal}>
                Done
              </Button>
              <Button onClick={() => setPrintTargetModalOpen(true)}>
                <Printer size={16} className="mr-2 shrink-0" />
                Print Receipt
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={closeSettlementModal} disabled={isSettling}>
                Cancel
              </Button>
              <Button type="submit" form="corp-settlement-form" isLoading={isSettling}>
                Record Settlement
              </Button>
            </div>
          )
        }
      >
        {settledResult ? (
          <p className="text-body-sm text-stone-600">
            The settlement was recorded successfully. You can print a thermal receipt as proof of
            payment now, or close this and print it later from the print jobs list.
          </p>
        ) : (
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
            <Select
              label="Payment Method"
              value={settlementForm.paymentMethod}
              onChange={(e) => setSettlementForm((c) => ({ ...c, paymentMethod: e.target.value as 'MPESA' | 'CASH' | 'CARD' }))}
              disabled={isSettling}
              options={[
                { value: 'MPESA', label: 'M-Pesa' },
                { value: 'CASH', label: 'Cash' },
                { value: 'CARD', label: 'Card' },
              ]}
            />
            <Input
              label="Note (optional)"
              value={settlementForm.note}
              onChange={(e) => setSettlementForm((c) => ({ ...c, note: e.target.value }))}
              placeholder="e.g. Bank transfer ref #123"
              disabled={isSettling}
            />
          </form>
        )}
      </Modal>

      <PrintTargetModal
        isOpen={printTargetModalOpen}
        onClose={() => {
          if (!isPrintingReceipt) setPrintTargetModalOpen(false);
        }}
        kind="SETTLEMENT"
        isSubmitting={isPrintingReceipt}
        onConfirm={(targetStationId) => void handlePrintSettlementReceipt(targetStationId)}
      />

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
