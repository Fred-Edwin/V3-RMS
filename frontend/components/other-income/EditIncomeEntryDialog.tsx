'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, FormField, Input, Modal, Select, Textarea } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { otherIncomeService } from '@/services/otherIncomeService';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import type {
  OtherIncomeCategoryDropdownItem,
  OtherIncomeEntry,
  UpdateEntryInput,
} from '@/types/otherIncome';

// ── Payment-method UI model (mirrors the Record Income page) ───────────────────

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

/** Collapse a stored entry back into the single UI payment-method value. */
const toUiPaymentMethod = (entry: OtherIncomeEntry): UiPaymentMethod => {
  if (entry.paymentMethod !== 'SPLIT') return entry.paymentMethod;
  switch (entry.splitType) {
    case 'MPESA_CASH':
      return 'SPLIT_MPESA_CASH';
    case 'MPESA_CARD':
      return 'SPLIT_MPESA_CARD';
    case 'CASH_CARD':
      return 'SPLIT_CASH_CARD';
    default:
      return 'SPLIT_MPESA_CASH';
  }
};

const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return 'KES 0.00';
  return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const CAN_CHANGE_DATE = new Set(['DIRECTOR', 'SYSTEM_ADMIN', 'MANAGER']);

// ── Edit-history change labels ────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  categoryId: 'Category',
  amount: 'Amount',
  paymentMethod: 'Payment method',
  mpesaCode: 'M-Pesa code',
  mpesaAmount: 'M-Pesa amount',
  cashAmount: 'Cash amount',
  cardAmount: 'Card amount',
  splitType: 'Split type',
  description: 'Notes',
  entryDate: 'Date',
};

interface EditIncomeEntryDialogProps {
  entry: OtherIncomeEntry | null;
  categories: OtherIncomeCategoryDropdownItem[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: OtherIncomeEntry) => void;
}

export function EditIncomeEntryDialog({
  entry,
  categories,
  isOpen,
  onClose,
  onSaved,
}: EditIncomeEntryDialogProps): JSX.Element | null {
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);
  const canChangeDate = role ? CAN_CHANGE_DATE.has(role) : false;

  const [categoryId, setCategoryId] = useState('');
  const [uiPaymentMethod, setUiPaymentMethod] = useState<UiPaymentMethod>('CASH');
  const [mpesaCode, setMpesaCode] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Reset the form whenever a different entry is opened.
  useEffect(() => {
    if (!entry) return;
    setCategoryId(entry.categoryId);
    setUiPaymentMethod(toUiPaymentMethod(entry));
    setMpesaCode(entry.mpesaCode ?? '');
    setMpesaAmount(entry.mpesaAmount ?? '');
    setCashAmount(entry.cashAmount ?? '');
    setCardAmount(entry.cardAmount ?? '');
    setAmount(entry.paymentMethod === 'SPLIT' ? '' : entry.amount);
    setDescription(entry.description ?? '');
    setEntryDate(entry.entryDate.slice(0, 10));
    setErrors({});
  }, [entry]);

  const isSplit = uiPaymentMethod.startsWith('SPLIT_');
  const hasMpesaCode =
    uiPaymentMethod === 'MPESA' ||
    uiPaymentMethod === 'SPLIT_MPESA_CASH' ||
    uiPaymentMethod === 'SPLIT_MPESA_CARD';

  const splitTotal = useMemo(() => {
    if (uiPaymentMethod === 'SPLIT_MPESA_CASH') {
      return (Number.parseFloat(mpesaAmount) || 0) + (Number.parseFloat(cashAmount) || 0);
    }
    if (uiPaymentMethod === 'SPLIT_MPESA_CARD') {
      return (Number.parseFloat(mpesaAmount) || 0) + (Number.parseFloat(cardAmount) || 0);
    }
    if (uiPaymentMethod === 'SPLIT_CASH_CARD') {
      return (Number.parseFloat(cashAmount) || 0) + (Number.parseFloat(cardAmount) || 0);
    }
    return 0;
  }, [uiPaymentMethod, mpesaAmount, cashAmount, cardAmount]);

  const handlePaymentMethodChange = (value: UiPaymentMethod) => {
    setUiPaymentMethod(value);
    setErrors({});
    // Clear fields that don't apply to the new method.
    if (!value.startsWith('SPLIT_')) {
      setMpesaAmount('');
      setCashAmount('');
      setCardAmount('');
    }
    if (value === 'CASH' || value === 'CARD' || value === 'SPLIT_CASH_CARD') {
      setMpesaCode('');
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!categoryId) next.categoryId = 'Select a category';
    if (!entryDate) next.entryDate = 'Select a date';

    if (isSplit) {
      if (uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD') {
        if (!mpesaAmount || Number.parseFloat(mpesaAmount) <= 0) next.mpesaAmount = 'Enter M-Pesa amount';
      }
      if (uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_CASH_CARD') {
        if (!cashAmount || Number.parseFloat(cashAmount) <= 0) next.cashAmount = 'Enter cash amount';
      }
      if (uiPaymentMethod === 'SPLIT_MPESA_CARD' || uiPaymentMethod === 'SPLIT_CASH_CARD') {
        if (!cardAmount || Number.parseFloat(cardAmount) <= 0) next.cardAmount = 'Enter card amount';
      }
      if (splitTotal <= 0) next.amount = 'Split amounts must be greater than 0';
    } else if (!amount || Number.isNaN(Number.parseFloat(amount)) || Number.parseFloat(amount) <= 0) {
      next.amount = 'Enter a valid amount greater than 0';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /** Build a payload carrying only the fields that actually changed. */
  const buildPayload = (): UpdateEntryInput | null => {
    if (!entry) return null;
    const payload: UpdateEntryInput = {};

    if (categoryId !== entry.categoryId) payload.categoryId = categoryId;
    if (entryDate !== entry.entryDate.slice(0, 10)) payload.entryDate = entryDate;
    if ((description.trim() || '') !== (entry.description ?? '')) {
      payload.description = description.trim();
    }

    if (isSplit) {
      payload.paymentMethod = 'SPLIT';
      payload.splitType =
        uiPaymentMethod === 'SPLIT_MPESA_CASH'
          ? 'MPESA_CASH'
          : uiPaymentMethod === 'SPLIT_MPESA_CARD'
            ? 'MPESA_CARD'
            : 'CASH_CARD';
      payload.amount = splitTotal.toFixed(2);
      if (uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD') {
        payload.mpesaAmount = Number.parseFloat(mpesaAmount).toFixed(2);
      }
      if (uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_CASH_CARD') {
        payload.cashAmount = Number.parseFloat(cashAmount).toFixed(2);
      }
      if (uiPaymentMethod === 'SPLIT_MPESA_CARD' || uiPaymentMethod === 'SPLIT_CASH_CARD') {
        payload.cardAmount = Number.parseFloat(cardAmount).toFixed(2);
      }
      if (hasMpesaCode && mpesaCode.trim()) payload.mpesaCode = mpesaCode.trim();
    } else {
      payload.paymentMethod = uiPaymentMethod as 'CASH' | 'MPESA' | 'CARD';
      payload.amount = Number.parseFloat(amount).toFixed(2);
      if (uiPaymentMethod === 'MPESA' && mpesaCode.trim()) payload.mpesaCode = mpesaCode.trim();
    }

    return payload;
  };

  const handleSave = async (): Promise<void> => {
    if (!accessToken || !entry || !validate()) return;
    const payload = buildPayload();
    if (!payload || Object.keys(payload).length === 0) {
      toast({ variant: 'info', title: 'No changes to save' });
      onClose();
      return;
    }
    setIsSaving(true);
    try {
      const updated = await otherIncomeService.updateEntry(entry.id, payload, accessToken);
      toast({ variant: 'success', title: 'Entry updated' });
      onSaved(updated);
      onClose();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not update entry';
      toast({ variant: 'error', title: message });
    } finally {
      setIsSaving(false);
    }
  };

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Select a category…' },
      ...categories.map((c) => ({
        value: c.id,
        label: c.branchName ? `${c.name} (${c.branchName})` : c.name,
      })),
    ],
    [categories],
  );

  // Ensure the entry's own category is selectable even if it's no longer in the
  // active list (e.g. archived) — otherwise the Select would silently blank out.
  const categoryOptionsWithCurrent = useMemo(() => {
    if (!entry || categoryOptions.some((o) => o.value === entry.categoryId)) return categoryOptions;
    return [...categoryOptions, { value: entry.categoryId, label: `${entry.category.name} (archived)` }];
  }, [categoryOptions, entry]);

  if (!entry) return null;

  const changeLabel = (field: string, value: string | null): string => {
    if (value === null || value === '') return '—';
    if (field === 'categoryId') {
      return categories.find((c) => c.id === value)?.name ?? value;
    }
    if (['amount', 'mpesaAmount', 'cashAmount', 'cardAmount'].includes(field)) {
      return formatCurrency(value);
    }
    return value;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit income entry"
      maxWidth="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} isLoading={isSaving} disabled={isSaving}>
            Save changes
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Income Category" htmlFor="edit-category" errorMessage={errors.categoryId} required>
          <Select
            id="edit-category"
            options={categoryOptionsWithCurrent}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          />
        </FormField>

        <FormField label="Payment Method" htmlFor="edit-payment" required>
          <Select
            id="edit-payment"
            options={PAYMENT_OPTIONS}
            value={uiPaymentMethod}
            onChange={(e) => handlePaymentMethodChange(e.target.value as UiPaymentMethod)}
          />
        </FormField>

        {hasMpesaCode && (
          <FormField label="M-Pesa Transaction Code" htmlFor="edit-mpesa-code">
            <Input
              id="edit-mpesa-code"
              placeholder="e.g. QHG3KL9XPO"
              value={mpesaCode}
              onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
            />
          </FormField>
        )}

        {!isSplit && (
          <FormField label="Amount (KES)" htmlFor="edit-amount" errorMessage={errors.amount} required>
            <Input
              id="edit-amount"
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

        {isSplit && (
          <div className="space-y-3 rounded-md border border-stone-200 p-4">
            <p className="text-label-sm font-medium text-stone-700">Amount for each payment method</p>
            <div className="grid grid-cols-2 gap-3">
              {(uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD') && (
                <FormField label="M-Pesa (KES)" htmlFor="edit-mpesa-amount" errorMessage={errors.mpesaAmount}>
                  <Input
                    id="edit-mpesa-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={mpesaAmount}
                    onChange={(e) => setMpesaAmount(e.target.value)}
                  />
                </FormField>
              )}
              {(uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_CASH_CARD') && (
                <FormField label="Cash (KES)" htmlFor="edit-cash-amount" errorMessage={errors.cashAmount}>
                  <Input
                    id="edit-cash-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                  />
                </FormField>
              )}
              {(uiPaymentMethod === 'SPLIT_MPESA_CARD' || uiPaymentMethod === 'SPLIT_CASH_CARD') && (
                <FormField label="Card (KES)" htmlFor="edit-card-amount" errorMessage={errors.cardAmount}>
                  <Input
                    id="edit-card-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                  />
                </FormField>
              )}
            </div>
            {splitTotal > 0 && (
              <p className="text-label-sm text-stone-600">
                Total: <span className="font-semibold text-stone-900">{formatCurrency(splitTotal)}</span>
              </p>
            )}
            {errors.amount && <p className="text-caption text-red-600">{errors.amount}</p>}
          </div>
        )}

        <FormField label="Date" htmlFor="edit-date" errorMessage={errors.entryDate} required>
          <Input
            id="edit-date"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            disabled={!canChangeDate}
          />
          {!canChangeDate && (
            <p className="mt-1 text-label-sm text-stone-500">Only a manager can change the date</p>
          )}
        </FormField>

        <FormField label="Notes" htmlFor="edit-notes" helperText="Optional">
          <Textarea
            id="edit-notes"
            placeholder="Add any relevant details…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </FormField>

        {/* Edit history */}
        {entry.edits.length > 0 && (
          <div className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="mb-2 text-label-sm font-semibold uppercase tracking-wide text-stone-500">
              Edit history
            </p>
            <ul className="space-y-2">
              {entry.edits.map((edit) => (
                <li key={edit.id} className="text-body-sm text-stone-600">
                  <span className="font-medium text-stone-800">{edit.editedBy.name}</span>
                  {' · '}
                  {new Date(edit.createdAt).toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  <ul className="mt-0.5 space-y-0.5 pl-3">
                    {edit.changes.map((c, i) => (
                      <li key={`${edit.id}-${c.field}-${i}`} className="text-caption text-stone-500">
                        {FIELD_LABELS[c.field] ?? c.field}: {changeLabel(c.field, c.from)} →{' '}
                        <span className="text-stone-700">{changeLabel(c.field, c.to)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
