'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, ChevronLeft, Printer } from 'lucide-react';
import {
  Button,
  FormField,
  Input,
  PageLayout,
  Select,
  Textarea,
  type SelectOption,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { branchService, type BranchDto } from '@/services/branchService';
import { otherIncomeService } from '@/services/otherIncomeService';
import { useAuthStore } from '@/store/authStore';
import { getTodayYmdInTimeZone } from '@/lib/date';
import { ApiError } from '@/types/api';
import type {
  OtherIncomeCategoryDropdownItem,
  OtherIncomeEntry,
  CreateEntryInput,
} from '@/types/otherIncome';

// ── Payment method UI types ───────────────────────────────────────────────────

type UiPaymentMethod =
  | 'CASH'
  | 'MPESA'
  | 'CARD'
  | 'SPLIT_MPESA_CASH'
  | 'SPLIT_MPESA_CARD'
  | 'SPLIT_CASH_CARD';

const PAYMENT_OPTIONS: Array<{ value: UiPaymentMethod; label: string }> = [
  { value: 'CASH', label: 'Cash' },
  { value: 'MPESA', label: 'M-Pesa' },
  { value: 'CARD', label: 'Card' },
  { value: 'SPLIT_MPESA_CASH', label: 'Split: M-Pesa + Cash' },
  { value: 'SPLIT_MPESA_CARD', label: 'Split: M-Pesa + Card' },
  { value: 'SPLIT_CASH_CARD', label: 'Split: Cash + Card' },
];

const CAN_CHANGE_DATE = new Set(['DIRECTOR', 'SYSTEM_ADMIN', 'MANAGER']);
const ORG_LEVEL_ROLES = new Set(['DIRECTOR', 'SYSTEM_ADMIN']);

// ── Receipt helpers ───────────────────────────────────────────────────────────

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return 'KES 0.00';
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatReceiptDate = (ymd: string): string => {
  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  MPESA: 'M-Pesa',
  CARD: 'Card',
  SPLIT: 'Split',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function RecordOtherIncomePage(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const user = useAuthStore((state) => state.user);

  const todayYmd = getTodayYmdInTimeZone();
  const canChangeDate = role ? CAN_CHANGE_DATE.has(role) : false;
  const isOrgLevel = role ? ORG_LEVEL_ROLES.has(role) : false;

  const [categories, setCategories] = useState<OtherIncomeCategoryDropdownItem[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [branches, setBranches] = useState<BranchDto[]>([]);

  // Form fields
  const [categoryId, setCategoryId] = useState('');
  const [uiPaymentMethod, setUiPaymentMethod] = useState<UiPaymentMethod>('CASH');
  const [mpesaCode, setMpesaCode] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [entryDate, setEntryDate] = useState(todayYmd);
  const [branchId, setBranchId] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Recorded entry — shown after successful submission for receipt printing
  const [recordedEntry, setRecordedEntry] = useState<OtherIncomeEntry | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  const loadCategories = useCallback(async (): Promise<void> => {
    if (!accessToken) return;
    setIsLoadingCategories(true);
    try {
      const data = await otherIncomeService.listActiveCategories(accessToken);
      setCategories(data);
    } catch {
      toast({ variant: 'error', title: 'Could not load income categories' });
    } finally {
      setIsLoadingCategories(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void loadCategories();
    if (isOrgLevel && accessToken) {
      branchService
        .listBranches(accessToken)
        .then((data) => setBranches(data.filter((b) => b.isActive && !b.isHub)))
        .catch(() => { /* non-critical */ });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCategories]); // isOrgLevel and accessToken are stable for the session

  // Reset split amounts when payment method changes
  const handlePaymentMethodChange = (value: UiPaymentMethod) => {
    setUiPaymentMethod(value);
    setMpesaCode('');
    setMpesaAmount('');
    setCashAmount('');
    setCardAmount('');
  };

  // Is this a split payment?
  const isSplit = uiPaymentMethod.startsWith('SPLIT_');
  const hasMpesa = uiPaymentMethod === 'MPESA' || uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD';

  // Effective total for split validation
  const splitTotal = (() => {
    if (uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD') {
      return (Number.parseFloat(mpesaAmount) || 0) + (uiPaymentMethod === 'SPLIT_MPESA_CASH' ? (Number.parseFloat(cashAmount) || 0) : (Number.parseFloat(cardAmount) || 0));
    }
    if (uiPaymentMethod === 'SPLIT_CASH_CARD') {
      return (Number.parseFloat(cashAmount) || 0) + (Number.parseFloat(cardAmount) || 0);
    }
    return 0;
  })();

  const splitDiff = isSplit && (Number.parseFloat(mpesaAmount) > 0 || Number.parseFloat(cashAmount) > 0 || Number.parseFloat(cardAmount) > 0)
    ? Math.abs(splitTotal - (Number.parseFloat(amount) || splitTotal))
    : 0;

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (isOrgLevel && !branchId) next.branchId = 'Select a branch';
    if (!categoryId) next.categoryId = 'Select a category';
    if (!entryDate) next.entryDate = 'Select a date';

    if (isSplit) {
      // For split, the total comes from the split amounts
      if (splitTotal <= 0) next.amount = 'Enter split amounts greater than 0';
      // Individual amounts must be present
      if (uiPaymentMethod === 'SPLIT_MPESA_CASH') {
        if (!mpesaAmount || Number.parseFloat(mpesaAmount) <= 0) next.mpesaAmount = 'Enter M-Pesa amount';
        if (!cashAmount || Number.parseFloat(cashAmount) <= 0) next.cashAmount = 'Enter cash amount';
      } else if (uiPaymentMethod === 'SPLIT_MPESA_CARD') {
        if (!mpesaAmount || Number.parseFloat(mpesaAmount) <= 0) next.mpesaAmount = 'Enter M-Pesa amount';
        if (!cardAmount || Number.parseFloat(cardAmount) <= 0) next.cardAmount = 'Enter card amount';
      } else if (uiPaymentMethod === 'SPLIT_CASH_CARD') {
        if (!cashAmount || Number.parseFloat(cashAmount) <= 0) next.cashAmount = 'Enter cash amount';
        if (!cardAmount || Number.parseFloat(cardAmount) <= 0) next.cardAmount = 'Enter card amount';
      }
    } else {
      if (!amount || Number.isNaN(Number.parseFloat(amount)) || Number.parseFloat(amount) <= 0) {
        next.amount = 'Enter a valid amount greater than 0';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Build the backend payload from the UI state
  const buildPayload = (): CreateEntryInput => {
    const base: CreateEntryInput = {
      categoryId,
      entryDate,
      description: description.trim() || undefined,
      branchId: isOrgLevel ? branchId : undefined,
      amount: '',
      paymentMethod: 'CASH',
    };

    if (isSplit) {
      base.paymentMethod = 'SPLIT';
      base.amount = splitTotal.toFixed(2);
      if (uiPaymentMethod === 'SPLIT_MPESA_CASH') {
        base.splitType = 'MPESA_CASH';
        base.mpesaAmount = Number.parseFloat(mpesaAmount).toFixed(2);
        base.cashAmount = Number.parseFloat(cashAmount).toFixed(2);
        if (mpesaCode.trim()) base.mpesaCode = mpesaCode.trim();
      } else if (uiPaymentMethod === 'SPLIT_MPESA_CARD') {
        base.splitType = 'MPESA_CARD';
        base.mpesaAmount = Number.parseFloat(mpesaAmount).toFixed(2);
        base.cardAmount = Number.parseFloat(cardAmount).toFixed(2);
        if (mpesaCode.trim()) base.mpesaCode = mpesaCode.trim();
      } else if (uiPaymentMethod === 'SPLIT_CASH_CARD') {
        base.splitType = 'CASH_CARD';
        base.cashAmount = Number.parseFloat(cashAmount).toFixed(2);
        base.cardAmount = Number.parseFloat(cardAmount).toFixed(2);
      }
    } else {
      base.paymentMethod = uiPaymentMethod as 'CASH' | 'MPESA' | 'CARD';
      base.amount = Number.parseFloat(amount).toFixed(2);
      if (uiPaymentMethod === 'MPESA' && mpesaCode.trim()) base.mpesaCode = mpesaCode.trim();
    }

    return base;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!accessToken || !validate()) return;
    setIsSubmitting(true);
    try {
      const entry = await otherIncomeService.createEntry(buildPayload(), accessToken);
      setRecordedEntry(entry);
      toast({ variant: 'success', title: 'Income recorded successfully' });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to record income';
      toast({ variant: 'error', title: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    const el = receiptRef.current;
    if (!el) return;
    const printContent = el.innerHTML;
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Other Income Receipt</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; font-size: 12px; padding: 16px; width: 80mm; }
            .receipt-title { text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 4px; }
            .receipt-sub { text-align: center; font-size: 11px; color: #555; margin-bottom: 12px; }
            .divider { border-top: 1px dashed #999; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .row .label { color: #555; }
            .row .value { font-weight: 500; text-align: right; }
            .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin: 6px 0; }
            .footer { text-align: center; margin-top: 12px; font-size: 10px; color: #777; }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const categoryOptions: SelectOption[] = categories.map((c) => ({
    value: c.id,
    label: c.branchName ? `${c.name} (${c.branchName})` : c.name,
  }));

  const recordedCategory = recordedEntry
    ? categories.find((c) => c.id === recordedEntry.categoryId)
    : null;

  // ── Render: post-submission receipt view ──────────────────────────────────
  if (recordedEntry) {
    const pm = recordedEntry.paymentMethod;
    const isSplitEntry = pm === 'SPLIT';
    return (
      <PageLayout>
        <header className="mb-6 flex items-center gap-3 border-b border-stone-200 pb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-md text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:shadow-focus"
            aria-label="Go back"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Banknote size={20} className="shrink-0 text-stone-400" />
            <h1 className="text-heading-lg font-sans font-semibold text-stone-900">Income Recorded</h1>
          </div>
        </header>

        {/* Confirmation card */}
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <p className="text-label-md font-semibold text-green-800">
            {formatCurrency(recordedEntry.amount)} recorded successfully
          </p>
          <p className="mt-0.5 text-body-sm text-green-700">
            {recordedCategory?.name ?? recordedEntry.category.name} · {formatReceiptDate(recordedEntry.entryDate.slice(0, 10))}
          </p>
        </div>

        {/* Print button */}
        <div className="mb-6">
          <Button variant="secondary" onClick={handlePrintReceipt}>
            <Printer size={16} className="mr-2" />
            Print Receipt
          </Button>
        </div>

        {/* Hidden receipt content used for printing */}
        <div ref={receiptRef} className="hidden">
          <div className="receipt-title">Wendo Coffee Bistro</div>
          <div className="receipt-sub">Other Income Receipt</div>
          <div className="divider" />
          <div className="row">
            <span className="label">Category</span>
            <span className="value">{recordedCategory?.name ?? recordedEntry.category.name}</span>
          </div>
          <div className="row">
            <span className="label">Date</span>
            <span className="value">{formatReceiptDate(recordedEntry.entryDate.slice(0, 10))}</span>
          </div>
          <div className="row">
            <span className="label">Recorded By</span>
            <span className="value">{user?.name ?? '—'}</span>
          </div>
          <div className="divider" />
          {isSplitEntry && (
            <>
              {recordedEntry.mpesaAmount && Number.parseFloat(recordedEntry.mpesaAmount) > 0 && (
                <div className="row">
                  <span className="label">M-Pesa</span>
                  <span className="value">{formatCurrency(recordedEntry.mpesaAmount)}</span>
                </div>
              )}
              {recordedEntry.mpesaCode && (
                <div className="row">
                  <span className="label">M-Pesa Code</span>
                  <span className="value">{recordedEntry.mpesaCode}</span>
                </div>
              )}
              {recordedEntry.cashAmount && Number.parseFloat(recordedEntry.cashAmount) > 0 && (
                <div className="row">
                  <span className="label">Cash</span>
                  <span className="value">{formatCurrency(recordedEntry.cashAmount)}</span>
                </div>
              )}
              {recordedEntry.cardAmount && Number.parseFloat(recordedEntry.cardAmount) > 0 && (
                <div className="row">
                  <span className="label">Card</span>
                  <span className="value">{formatCurrency(recordedEntry.cardAmount)}</span>
                </div>
              )}
            </>
          )}
          {!isSplitEntry && (
            <>
              <div className="row">
                <span className="label">Payment</span>
                <span className="value">{PAYMENT_LABELS[pm] ?? pm}</span>
              </div>
              {pm === 'MPESA' && recordedEntry.mpesaCode && (
                <div className="row">
                  <span className="label">M-Pesa Code</span>
                  <span className="value">{recordedEntry.mpesaCode}</span>
                </div>
              )}
            </>
          )}
          <div className="divider" />
          <div className="total-row">
            <span>TOTAL</span>
            <span>{formatCurrency(recordedEntry.amount)}</span>
          </div>
          {recordedEntry.description && (
            <>
              <div className="divider" />
              <div className="row">
                <span className="label">Notes</span>
                <span className="value">{recordedEntry.description}</span>
              </div>
            </>
          )}
          <div className="divider" />
          <div className="footer">Thank you</div>
        </div>

        {/* Done button */}
        <Button variant="ghost" onClick={() => router.back()} className="mt-2">
          Done
        </Button>
      </PageLayout>
    );
  }

  // ── Render: entry form ────────────────────────────────────────────────────
  return (
    <PageLayout>
      {/* Header */}
      <header className="mb-6 flex items-center gap-3 border-b border-stone-200 pb-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-md text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:shadow-focus"
          aria-label="Go back"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Banknote size={20} className="shrink-0 text-stone-400" />
          <div>
            <h1 className="text-heading-lg font-sans font-semibold text-stone-900">
              Record Other Income
            </h1>
            <p className="mt-0.5 text-body-sm text-stone-500">
              Pool table, events, merchandise, and other revenue
            </p>
          </div>
        </div>
      </header>

      {/* Form */}
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-5">
        {/* Branch selector — org-level roles only (DIRECTOR, SYSTEM_ADMIN) */}
        {isOrgLevel && (
          <FormField label="Branch" htmlFor="branch" errorMessage={errors.branchId} required>
            <Select
              id="branch"
              options={[
                { value: '', label: 'Select a branch…' },
                ...branches.map((b) => ({ value: b.id, label: b.name })),
              ]}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            />
          </FormField>
        )}

        {/* Category */}
        <FormField label="Income Category" htmlFor="category" errorMessage={errors.categoryId} required>
          <Select
            id="category"
            options={[
              { value: '', label: 'Select a category…' },
              ...categoryOptions,
            ]}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={isLoadingCategories || categories.length === 0}
          />
          {isLoadingCategories && (
            <p className="mt-1 text-caption text-stone-500">Loading categories…</p>
          )}
          {!isLoadingCategories && categories.length === 0 && (
            <p className="mt-1.5 text-body-sm text-amber-600">
              No income categories configured yet. Ask your Director to add some.
            </p>
          )}
        </FormField>

        {/* Payment method */}
        <FormField label="Payment Method" htmlFor="payment" required>
          <Select
            id="payment"
            options={PAYMENT_OPTIONS}
            value={uiPaymentMethod}
            onChange={(e) => handlePaymentMethodChange(e.target.value as UiPaymentMethod)}
          />
        </FormField>

        {/* M-Pesa transaction code — shown for MPESA and split types that include M-Pesa */}
        {hasMpesa && (
          <FormField label="M-Pesa Transaction Code" htmlFor="mpesa-code">
            <Input
              id="mpesa-code"
              placeholder="e.g. QHG3KL9XPO"
              value={mpesaCode}
              onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
            />
          </FormField>
        )}

        {/* Single payment amount */}
        {!isSplit && (
          <FormField label="Amount (KES)" htmlFor="amount" errorMessage={errors.amount} required>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </FormField>
        )}

        {/* Split payment amounts */}
        {isSplit && (
          <div className="rounded-md border border-stone-200 p-4 space-y-3">
            <p className="text-label-sm font-medium text-stone-700">
              Enter amounts for each payment method
            </p>
            <div className="grid grid-cols-2 gap-3">
              {/* M-Pesa amount (SPLIT_MPESA_CASH, SPLIT_MPESA_CARD) */}
              {(uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD') && (
                <FormField label="M-Pesa (KES)" htmlFor="mpesa-amount" errorMessage={errors.mpesaAmount}>
                  <Input
                    id="mpesa-amount"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={mpesaAmount}
                    onChange={(e) => setMpesaAmount(e.target.value)}
                  />
                </FormField>
              )}

              {/* Cash amount (SPLIT_MPESA_CASH, SPLIT_CASH_CARD) */}
              {(uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_CASH_CARD') && (
                <FormField label="Cash (KES)" htmlFor="cash-amount" errorMessage={errors.cashAmount}>
                  <Input
                    id="cash-amount"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                  />
                </FormField>
              )}

              {/* Card amount (SPLIT_MPESA_CARD, SPLIT_CASH_CARD) */}
              {(uiPaymentMethod === 'SPLIT_MPESA_CARD' || uiPaymentMethod === 'SPLIT_CASH_CARD') && (
                <FormField label="Card (KES)" htmlFor="card-amount" errorMessage={errors.cardAmount}>
                  <Input
                    id="card-amount"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                  />
                </FormField>
              )}
            </div>

            {/* Split total display */}
            {splitTotal > 0 && (
              <p className="text-label-sm text-stone-600">
                Total:{' '}
                <span className="font-semibold text-stone-900">{formatCurrency(splitTotal)}</span>
              </p>
            )}

            {/* Split mismatch warning (if user manually edits both fields) */}
            {splitDiff > 1 && (
              <p className="text-caption text-red-600">
                Amounts don&apos;t match — please verify the total is correct.
              </p>
            )}

            {/* Hidden amount field to satisfy validate() — driven by splitTotal */}
            {errors.amount && (
              <p className="text-caption text-red-600">{errors.amount}</p>
            )}
          </div>
        )}

        {/* Date — only editable for Manager+ */}
        <FormField label="Date" htmlFor="entryDate" errorMessage={errors.entryDate} required>
          <Input
            id="entryDate"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            disabled={!canChangeDate}
            max={todayYmd}
          />
          {!canChangeDate && (
            <p className="mt-1 text-label-sm text-stone-500">Entries are recorded for today</p>
          )}
        </FormField>

        {/* Description (optional) */}
        <FormField
          label="Notes"
          htmlFor="description"
          helperText="Optional — e.g. tournament name, event details"
        >
          <Textarea
            id="description"
            placeholder="Add any relevant details…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </FormField>

        {/* Submit */}
        <div className="pt-2">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isSubmitting}
            disabled={isSubmitting || isLoadingCategories}
          >
            Record Income
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
