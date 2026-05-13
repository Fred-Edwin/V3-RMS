'use client';

import { useState } from 'react';
import { Printer, ChefHat, Coffee, Clock, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { BottomSheet, Button, Input } from '@/components/ui';
import { env } from '@/lib/env';
import type { OrderDetail, PaymentMethod, SplitPaymentLine } from '@/types/order';
import type { HouseAccountDropdownItem } from '@/services/houseAccountService';
import type { CorporateAccountDropdownItem } from '@/services/corporateAccountService';
import type { CustomerCreditDropdownItem } from '@/services/customerCreditService';
import type { Discount } from '@/types/discount';

// ─── Public types ────────────────────────────────────────────────────────────

export interface PaymentPayload {
  paymentMethod: PaymentMethod;
  mpesaCode?: string;
  mpesaAmount?: number;
  cashAmount?: number;
  cardAmount?: number;
  splitType?: string;
  houseAccountId?: string;
  corporateAccountId?: string;
  corporateEmployeeRef?: string;
  customerCreditAccountId?: string;
  applyStaffDiscount?: boolean;
  applyDiscountId?: string;
}

export interface AddSplitLinePayload {
  label: string;
  amount: number;
  method: 'MPESA' | 'CASH' | 'CARD';
  mpesaCode?: string;
}

interface OrderDetailBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetail | null;
  onEdit: (orderId: string) => void;
  onPayment: (orderId: string, payload: PaymentPayload) => void;
  onCancel?: (orderId: string) => void;
  onPrintBill?: (orderId: string) => void;
  onPrintReceipt?: (orderId: string) => void;
  isPaymentSubmitting?: boolean;
  isPrintBillSubmitting?: boolean;
  isPrintSubmitting?: boolean;
  isOwner?: boolean;
  isManager?: boolean;
  houseAccounts?: HouseAccountDropdownItem[];
  corporateAccounts?: CorporateAccountDropdownItem[];
  customerCreditAccounts?: CustomerCreditDropdownItem[];
  onCreateCustomerCredit?: (name: string, phone: string, creditLimit: string) => Promise<string>;
  onAuthOverride?: (orderId: string, decision: 'APPROVED' | 'REJECTED') => void;
  onAuthForceExpire?: (orderId: string) => void;
  isAuthOverrideSubmitting?: boolean;
  pendingAuthHolderName?: string;
  pendingAuthRequestId?: string;
  pendingAuthExpiresAt?: string;
  pendingStaffDiscountRequestId?: string;
  onStaffDiscountOverride?: (orderId: string, decision: 'APPROVED' | 'REJECTED') => void;
  isStaffDiscountOverrideSubmitting?: boolean;
  availableDiscounts?: Discount[];
  pendingCustomerDiscountRequestId?: string;
  pendingCustomerDiscountName?: string;
  onCustomerDiscountOverride?: (orderId: string, decision: 'APPROVED' | 'REJECTED') => void;
  isCustomerDiscountOverrideSubmitting?: boolean;
  // Guest split callbacks
  onAddSplitLine?: (orderId: string, payload: AddSplitLinePayload) => Promise<SplitPaymentLine>;
  onDeleteSplitLine?: (orderId: string, lineId: string) => Promise<void>;
}

// ─── Internal types ───────────────────────────────────────────────────────────

type UiPaymentValue =
  | PaymentMethod
  | 'SPLIT_MPESA_CASH'
  | 'SPLIT_MPESA_CARD'
  | 'SPLIT_CASH_CARD';

type GuestLineMethod = 'MPESA' | 'CASH' | 'CARD';

interface GuestSlot {
  id: string; // temporary client id
  label: string;
  amount: string;
  method: GuestLineMethod;
  mpesaCode: string;
  confirmed: boolean;
  serverLine: SplitPaymentLine | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  MPESA: 'M-Pesa',
  CASH: 'Cash',
  CARD: 'Card',
  SPLIT: 'Split (2 methods)',
  GUEST_SPLIT: 'Split between guests',
  HOUSE_ACCOUNT: 'House Account',
  CORPORATE_ACCOUNT: 'Corporate Account',
  CUSTOMER_CREDIT: 'Customer Credit',
};

// ─── Small design primitives ──────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-stone-500 px-0 pb-2">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="h-px bg-stone-200 my-1" />;
}

// ─── Payment summary (closed order) ──────────────────────────────────────────

function PaymentSummary({ order }: { order: OrderDetail }) {
  const method = order.paymentMethod;
  if (!method) return null;

  const label = PAYMENT_METHOD_LABELS[method] ?? method;
  const paidAt = order.paidAt
    ? new Date(order.paidAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const Row = ({ title, value }: { title: string; value: string }) => (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-stone-500">{title}</span>
      <span className="text-[13px] font-medium text-stone-800">{value}</span>
    </div>
  );

  return (
    <div className="rounded-xl border border-stone-200 bg-[#F5F0E8] p-4 space-y-2">
      <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-stone-400">Payment</p>
      <Row title="Method" value={label} />
      {method === 'MPESA' && order.mpesaCode && <Row title="M-Pesa code" value={order.mpesaCode} />}
      {method === 'MPESA' && order.mpesaAmount && (
        <Row title="Amount" value={`KES ${parseFloat(order.mpesaAmount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`} />
      )}
      {method === 'CASH' && order.cashAmount && (
        <Row title="Amount" value={`KES ${parseFloat(order.cashAmount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`} />
      )}
      {method === 'CARD' && order.cardAmount && (
        <Row title="Amount" value={`KES ${parseFloat(order.cardAmount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`} />
      )}
      {method === 'SPLIT' && (
        <>
          {order.mpesaAmount && parseFloat(order.mpesaAmount) > 0 && (
            <Row title="M-Pesa" value={`KES ${parseFloat(order.mpesaAmount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`} />
          )}
          {order.cashAmount && parseFloat(order.cashAmount) > 0 && (
            <Row title="Cash" value={`KES ${parseFloat(order.cashAmount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`} />
          )}
          {order.cardAmount && parseFloat(order.cardAmount) > 0 && (
            <Row title="Card" value={`KES ${parseFloat(order.cardAmount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`} />
          )}
        </>
      )}
      {method === 'GUEST_SPLIT' && order.splitPaymentLines?.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-stone-200">
          {order.splitPaymentLines.map((line) => (
            <Row
              key={line.id}
              title={line.label}
              value={`KES ${parseFloat(line.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })} · ${PAYMENT_METHOD_LABELS[line.method] ?? line.method}`}
            />
          ))}
        </div>
      )}
      {order.discountAmount && (
        <>
          <Row
            title={order.discountId ? 'Discount' : 'Staff Discount'}
            value={
              order.discountPercent
                ? `${parseFloat(order.discountPercent).toFixed(0)}% off`
                : `KES ${parseFloat(order.discountAmount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
            }
          />
          <Row title="Saved" value={`KES ${parseFloat(order.discountAmount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`} />
        </>
      )}
      {paidAt && <Row title="Paid at" value={paidAt} />}
    </div>
  );
}

// ─── Payment method option card ───────────────────────────────────────────────

function MethodCard({
  icon,
  label,
  sub,
  selected,
  onClick,
}: {
  icon: string;
  label: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border-[1.5px] transition-all text-left ${
        selected
          ? 'border-[#2C1810] bg-white'
          : 'border-stone-200 bg-[#EDE7DC] hover:border-stone-300'
      }`}
    >
      <span className="text-xl shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-[14px] font-semibold leading-tight ${selected ? 'text-[#2C1810]' : 'text-stone-800'}`}>
          {label}
        </p>
        <p className="text-[12px] text-stone-500 mt-0.5">{sub}</p>
      </div>
      <span
        className={`shrink-0 size-[18px] rounded-full border-2 flex items-center justify-center transition-all ${
          selected ? 'border-[#2C1810] bg-[#2C1810]' : 'border-stone-300'
        }`}
      >
        {selected && <span className="size-1.5 rounded-full bg-[#F5F0E8]" />}
      </span>
    </button>
  );
}

// ─── Method pills (per-guest) ─────────────────────────────────────────────────

function MethodPills({
  value,
  onChange,
}: {
  value: GuestLineMethod;
  onChange: (m: GuestLineMethod) => void;
}) {
  const opts: Array<{ v: GuestLineMethod; icon: string; label: string }> = [
    { v: 'MPESA', icon: '📱', label: 'M-Pesa' },
    { v: 'CASH', icon: '💵', label: 'Cash' },
    { v: 'CARD', icon: '💳', label: 'Card' },
  ];
  return (
    <div className="flex gap-2">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-[1.5px] text-[13px] font-medium transition-all ${
            value === o.v
              ? 'border-[#2C1810] bg-[#2C1810] text-[#F5F0E8]'
              : 'border-stone-200 bg-[#F5F0E8] text-stone-700 hover:border-stone-300'
          }`}
        >
          <span>{o.icon}</span>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Guest count picker ───────────────────────────────────────────────────────

function GuestCountPicker({ onConfirm }: { onConfirm: (count: number) => void }) {
  const [count, setCount] = useState(2);
  return (
    <div className="space-y-6 py-2">
      <div className="text-center space-y-1">
        <p className="text-[13px] text-stone-500 tracking-wide uppercase font-medium">Number of guests</p>
        <p className="text-[12px] text-stone-400">Each guest will pay their share separately</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => setCount((c) => Math.max(2, c - 1))}
          disabled={count <= 2}
          className="size-14 rounded-full border-[2px] border-stone-300 flex items-center justify-center text-[24px] text-stone-600 hover:border-[#2C1810] hover:text-[#2C1810] disabled:opacity-30 disabled:cursor-default transition-all active:scale-95"
        >
          −
        </button>
        <div className="w-20 text-center">
          <span className="text-[56px] font-bold text-[#2C1810] leading-none tabular-nums">{count}</span>
          <p className="text-[12px] text-stone-400 mt-1">{count === 2 ? 'guests' : 'guests'}</p>
        </div>
        <button
          type="button"
          onClick={() => setCount((c) => Math.min(20, c + 1))}
          disabled={count >= 20}
          className="size-14 rounded-full border-[2px] border-stone-300 flex items-center justify-center text-[24px] text-stone-600 hover:border-[#2C1810] hover:text-[#2C1810] disabled:opacity-30 disabled:cursor-default transition-all active:scale-95"
        >
          +
        </button>
      </div>

      {/* Quick picks for common counts */}
      <div className="flex gap-2 justify-center">
        {[2, 3, 4, 5, 6].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setCount(n)}
            className={`size-10 rounded-full text-[14px] font-semibold border-[1.5px] transition-all ${
              count === n
                ? 'bg-[#2C1810] text-[#F5F0E8] border-[#2C1810]'
                : 'bg-transparent text-stone-600 border-stone-200 hover:border-stone-400'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onConfirm(count)}
        className="w-full py-4 rounded-[14px] bg-[#2C1810] text-[#F5F0E8] font-semibold text-[15px] tracking-[0.02em] hover:bg-[#4A2C1A] transition-colors active:scale-[0.98]"
      >
        Split between {count} guests
      </button>
    </div>
  );
}

// ─── Guest split panel ────────────────────────────────────────────────────────

function GuestSplitPanel({
  order,
  onAddSplitLine,
  onDeleteSplitLine,
  onCloseOrder,
  isClosingOrder,
}: {
  order: OrderDetail;
  onAddSplitLine: (payload: AddSplitLinePayload) => Promise<SplitPaymentLine>;
  onDeleteSplitLine: (lineId: string) => Promise<void>;
  onCloseOrder: () => void;
  isClosingOrder: boolean;
}) {
  const orderTotal = parseFloat(order.total);

  const makeSlot = (index: number): GuestSlot => ({
    id: `slot-${Date.now()}-${index}`,
    label: `Guest ${index + 1}`,
    amount: '',
    method: 'MPESA',
    mpesaCode: '',
    confirmed: false,
    serverLine: null,
  });

  const [guestCount, setGuestCount] = useState<number | null>(null);
  const [slots, setSlots] = useState<GuestSlot[]>([]);
  const [expandedId, setExpandedId] = useState<string>('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function initSlots(count: number) {
    const initial = Array.from({ length: count }, (_, i) => makeSlot(i));
    setSlots(initial);
    setExpandedId(initial[0]?.id ?? '');
    setGuestCount(count);
  }

  const confirmedSum = slots
    .filter((s) => s.confirmed && s.serverLine)
    .reduce((acc, s) => acc + parseFloat(s.serverLine!.amount), 0);
  const remaining = orderTotal - confirmedSum;
  const allConfirmed = slots.every((s) => s.confirmed) && Math.abs(remaining) <= 1;
  const progressPct = Math.min(100, (confirmedSum / orderTotal) * 100);

  function setSlot(id: string, patch: Partial<GuestSlot>) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function addGuest() {
    const next = makeSlot(slots.length);
    setSlots((prev) => [...prev, next]);
    setExpandedId(next.id);
  }

  async function confirmGuest(slot: GuestSlot) {
    const amount = parseFloat(slot.amount);
    if (!amount || amount <= 0) return;
    if (slot.method === 'MPESA' && !slot.mpesaCode.trim()) return;

    setSubmittingId(slot.id);
    try {
      const line = await onAddSplitLine({
        label: slot.label,
        amount,
        method: slot.method,
        mpesaCode: slot.method === 'MPESA' ? slot.mpesaCode.trim() : undefined,
      });
      setSlot(slot.id, { confirmed: true, serverLine: line });
      // Expand the next unconfirmed slot
      const nextUnconfirmed = slots.find((s) => !s.confirmed && s.id !== slot.id);
      if (nextUnconfirmed) setExpandedId(nextUnconfirmed.id);
    } finally {
      setSubmittingId(null);
    }
  }

  async function removeGuest(slot: GuestSlot) {
    if (!slot.serverLine) {
      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
      return;
    }
    setDeletingId(slot.id);
    try {
      await onDeleteSplitLine(slot.serverLine.id);
      setSlot(slot.id, { confirmed: false, serverLine: null, amount: '', mpesaCode: '' });
      setExpandedId(slot.id);
    } finally {
      setDeletingId(null);
    }
  }

  if (guestCount === null) {
    return <GuestCountPicker onConfirm={initSlots} />;
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-[13px] text-stone-500">
            Collected{' '}
            <span className="font-semibold text-stone-900">
              KES {confirmedSum.toLocaleString('en-KE', { minimumFractionDigits: 0 })}
            </span>{' '}
            of KES {orderTotal.toLocaleString('en-KE', { minimumFractionDigits: 0 })}
          </span>
          {allConfirmed ? (
            <span className="text-[13px] font-semibold text-[#1A6B3C]">✓ Complete</span>
          ) : (
            <span className="text-[13px] font-semibold text-[#C4862A]">
              KES {remaining.toLocaleString('en-KE', { minimumFractionDigits: 0 })} left
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allConfirmed ? 'bg-[#1A6B3C]' : 'bg-[#2C1810]'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Guest slots */}
      <div className="space-y-2">
        {slots.map((slot, idx) => {
          const isExpanded = expandedId === slot.id && !slot.confirmed;
          const amount = parseFloat(slot.amount) || 0;
          const canConfirm =
            amount > 0 &&
            (slot.method !== 'MPESA' || slot.mpesaCode.trim().length > 0) &&
            submittingId !== slot.id;

          if (slot.confirmed && slot.serverLine) {
            // Confirmed card
            return (
              <div key={slot.id} className="rounded-xl border-[1.5px] border-[#86EFAC] bg-[#EDFAF1] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="size-8 rounded-full bg-[#1A6B3C] flex items-center justify-center text-white text-[13px] font-semibold shrink-0">
                      ✓
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold text-stone-900">{slot.label}</p>
                      <p className="text-[12px] text-stone-500">
                        {PAYMENT_METHOD_LABELS[slot.method]}
                        {slot.serverLine.mpesaCode ? ` · ${slot.serverLine.mpesaCode}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[15px] font-semibold text-stone-900">
                        KES {parseFloat(slot.serverLine.amount).toLocaleString('en-KE', { minimumFractionDigits: 0 })}
                      </p>
                      <span className="text-[11px] font-semibold text-[#1A6B3C] tracking-[0.04em] uppercase">Paid</span>
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === slot.id}
                      onClick={() => removeGuest(slot)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                      title="Remove payment"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // Collapsed unpaid card
          if (!isExpanded) {
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => setExpandedId(slot.id)}
                className="w-full rounded-xl border-[1.5px] border-stone-200 bg-[#EDE7DC] px-4 py-3 flex items-center justify-between hover:border-stone-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="size-8 rounded-full bg-stone-200 flex items-center justify-center text-[13px] font-semibold text-stone-600 shrink-0">
                    {idx + 1}
                  </span>
                  <div className="text-left">
                    <p className="text-[14px] font-semibold text-stone-800">{slot.label}</p>
                    <p className="text-[12px] text-stone-500">Tap to set amount</p>
                  </div>
                </div>
                <span className="text-stone-400 text-[18px]">›</span>
              </button>
            );
          }

          // Expanded unpaid card
          return (
            <div key={slot.id} className="rounded-xl border-[1.5px] border-[#2C1810] bg-[#EDE7DC] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
                <div className="flex items-center gap-3">
                  <span className="size-8 rounded-full bg-stone-200 flex items-center justify-center text-[13px] font-semibold text-stone-600 shrink-0">
                    {idx + 1}
                  </span>
                  <p className="text-[14px] font-semibold text-stone-900">{slot.label}</p>
                </div>
                {slots.length > 2 && !slot.confirmed && (
                  <button
                    type="button"
                    onClick={() => setSlots((prev) => prev.filter((s) => s.id !== slot.id))}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="px-4 py-4 space-y-4">
                {/* Amount */}
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-stone-500 mb-2">Amount</p>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-stone-500">KES</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={slot.amount}
                      onChange={(e) => {
                        setSlot(slot.id, { amount: e.target.value });
                      }}
                      className="w-full pl-12 pr-4 py-3 text-[20px] font-semibold text-stone-900 bg-white border-[1.5px] border-stone-200 rounded-xl focus:outline-none focus:border-[#2C1810]"
                    />
                  </div>
                  {/* Equal split suggestion */}
                  {remaining > 0 && !slot.amount && (
                    <button
                      type="button"
                      className="mt-2 flex items-center gap-1.5 text-[12px] text-stone-500 hover:text-stone-700"
                      onClick={() => {
                        const unconfirmedCount = slots.filter((s) => !s.confirmed).length;
                        const equalShare = (remaining / unconfirmedCount).toFixed(0);
                        setSlot(slot.id, { amount: equalShare });
                      }}
                    >
                      <span>⚖️</span>
                      Split remaining equally — KES {Math.round(remaining / slots.filter((s) => !s.confirmed).length).toLocaleString('en-KE')}
                    </button>
                  )}
                </div>

                {/* Method */}
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-stone-500 mb-2">Payment method</p>
                  <MethodPills value={slot.method} onChange={(m) => setSlot(slot.id, { method: m, mpesaCode: '' })} />
                </div>

                {/* Mpesa code */}
                {slot.method === 'MPESA' && (
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-stone-500 mb-2">M-Pesa code</p>
                    <input
                      type="text"
                      placeholder="e.g. QHX7K2P1MN"
                      value={slot.mpesaCode}
                      onChange={(e) => setSlot(slot.id, { mpesaCode: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                      className="w-full px-4 py-3 text-[14px] text-stone-900 tracking-[0.04em] bg-white border-[1.5px] border-stone-200 rounded-xl focus:outline-none focus:border-[#2C1810] placeholder:text-stone-300"
                    />
                  </div>
                )}

                <button
                  type="button"
                  disabled={!canConfirm || submittingId === slot.id}
                  onClick={() => confirmGuest(slot)}
                  className="w-full py-3.5 rounded-xl font-semibold text-[14px] tracking-[0.02em] transition-all disabled:bg-stone-200 disabled:text-stone-400 bg-[#2C1810] text-[#F5F0E8] hover:bg-[#4A2C1A]"
                >
                  {submittingId === slot.id
                    ? 'Recording…'
                    : amount > 0
                    ? `Confirm ${slot.label} — KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`
                    : `Confirm ${slot.label}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add guest row */}
      <button
        type="button"
        onClick={addGuest}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border-[1.5px] border-dashed border-stone-300 text-[13px] font-medium text-stone-500 hover:border-stone-400 hover:text-stone-600 transition-colors"
      >
        <Plus size={16} />
        Add another guest
      </button>

      {/* Info pill if amounts don't balance */}
      {confirmedSum > 0 && !allConfirmed && remaining > 1 && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#F0C97A]/30 border border-[#F0C97A]">
          <span className="text-[14px] shrink-0 mt-0.5">ℹ️</span>
          <p className="text-[12px] text-stone-700 leading-relaxed">
            Amounts must total KES {orderTotal.toLocaleString('en-KE', { minimumFractionDigits: 0 })}.{' '}
            KES {remaining.toLocaleString('en-KE', { minimumFractionDigits: 0 })} still to collect.
          </p>
        </div>
      )}

      {/* Close order button */}
      <button
        type="button"
        disabled={!allConfirmed || isClosingOrder}
        onClick={onCloseOrder}
        className={`w-full py-4 rounded-[14px] font-semibold text-[15px] tracking-[0.02em] transition-all flex items-center justify-center gap-2 ${
          allConfirmed
            ? 'bg-[#1A6B3C] text-white hover:bg-[#155a32]'
            : 'bg-stone-200 text-stone-400 cursor-default'
        }`}
      >
        {isClosingOrder ? (
          'Closing order…'
        ) : allConfirmed ? (
          <>
            <CheckCircle2 size={18} />
            Close order — KES {orderTotal.toLocaleString('en-KE', { minimumFractionDigits: 0 })} collected
          </>
        ) : (
          'Close order'
        )}
      </button>
      {!allConfirmed && (
        <p className="text-center text-[12px] text-stone-500">
          {slots.every((s) => s.confirmed)
            ? `Amounts collected don't match the order total`
            : 'Collect payment from all guests to close'}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OrderDetailBottomSheet({
  isOpen,
  onClose,
  order,
  onEdit,
  onPayment,
  onCancel,
  onPrintBill,
  onPrintReceipt,
  isPaymentSubmitting = false,
  isPrintBillSubmitting = false,
  isPrintSubmitting = false,
  isOwner = false,
  isManager = false,
  houseAccounts = [],
  corporateAccounts = [],
  customerCreditAccounts = [],
  onCreateCustomerCredit,
  onAuthOverride,
  onAuthForceExpire,
  isAuthOverrideSubmitting = false,
  pendingAuthHolderName,
  pendingAuthRequestId,
  pendingAuthExpiresAt,
  pendingStaffDiscountRequestId,
  onStaffDiscountOverride,
  isStaffDiscountOverrideSubmitting = false,
  availableDiscounts = [],
  pendingCustomerDiscountRequestId,
  pendingCustomerDiscountName,
  onCustomerDiscountOverride,
  isCustomerDiscountOverrideSubmitting = false,
  onAddSplitLine,
  onDeleteSplitLine,
}: OrderDetailBottomSheetProps) {
  const [uiPaymentMethod, setUiPaymentMethod] = useState<UiPaymentValue>('MPESA');
  const [mpesaCode, setMpesaCode] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [isReprintConfirmOpen, setIsReprintConfirmOpen] = useState(false);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(null);
  const [selectedHouseAccountId, setSelectedHouseAccountId] = useState('');
  const [selectedCorporateAccountId, setSelectedCorporateAccountId] = useState('');
  const [corporateEmployeeRef, setCorporateEmployeeRef] = useState('');
  const [selectedCustomerCreditId, setSelectedCustomerCreditId] = useState('');
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerLimit, setNewCustomerLimit] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  if (!order) return null;

  const isPaid = Boolean(order.paymentMethod);
  const isCancellationPending = order.status === 'AWAITING_CANCELLATION_APPROVAL';
  const canEdit =
    (isOwner || isManager) &&
    order.status !== 'CLOSED' &&
    order.status !== 'CANCELLED' &&
    order.status !== 'AWAITING_AUTHORIZATION' &&
    !isCancellationPending;
  const canCancel =
    (isOwner || isManager) &&
    order.status !== 'CLOSED' &&
    order.status !== 'CANCELLED' &&
    order.status !== 'AWAITING_AUTHORIZATION' &&
    !isCancellationPending;
  const canPrintBill =
    Boolean(onPrintBill) &&
    !isPaid &&
    order.status !== 'PENDING' &&
    order.status !== 'CANCELLED' &&
    !isCancellationPending;

  const resetPaymentForm = () => {
    setMpesaCode('');
    setMpesaAmount('');
    setCashAmount('');
    setCardAmount('');
    setSelectedHouseAccountId('');
    setSelectedCorporateAccountId('');
    setCorporateEmployeeRef('');
    setSelectedCustomerCreditId('');
    setShowNewCustomerForm(false);
  };

  // ── Derived split validation ────────────────────────────────────────────────
  const orderTotal = parseFloat(order.total);
  const isMethodSplit = uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD' || uiPaymentMethod === 'SPLIT_CASH_CARD';
  const splitA =
    uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD'
      ? parseFloat(mpesaAmount) || 0
      : parseFloat(cashAmount) || 0;
  const splitB =
    uiPaymentMethod === 'SPLIT_MPESA_CASH'
      ? parseFloat(cashAmount) || 0
      : parseFloat(cardAmount) || 0;
  const splitSum = splitA + splitB;
  const splitInvalid = isMethodSplit && (splitA <= 0 || splitB <= 0 || Math.abs(splitSum - orderTotal) > 1);
  const splitErrorMsg =
    isMethodSplit && splitA > 0 && splitB > 0 && Math.abs(splitSum - orderTotal) > 1
      ? `Amounts total KES ${splitSum.toFixed(2)} — must equal KES ${orderTotal.toFixed(2)}`
      : null;

  // ── Confirm payment button disabled check ───────────────────────────────────
  const confirmDisabled =
    ((uiPaymentMethod === 'MPESA' || uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD') && !mpesaCode.trim()) ||
    (isMethodSplit && splitInvalid) ||
    (uiPaymentMethod === 'HOUSE_ACCOUNT' && !selectedHouseAccountId) ||
    (uiPaymentMethod === 'CORPORATE_ACCOUNT' && !selectedCorporateAccountId) ||
    (uiPaymentMethod === 'CUSTOMER_CREDIT' && !selectedCustomerCreditId);

  function handleConfirmPayment() {
    if (!order) return;
    if (selectedDiscountId === 'staff' && !order.discountAmount) {
      onPayment(order.id, { paymentMethod: uiPaymentMethod as PaymentMethod, applyStaffDiscount: true });
      return;
    }
    if (selectedDiscountId !== null && selectedDiscountId !== 'staff' && !order.discountAmount) {
      onPayment(order.id, { paymentMethod: uiPaymentMethod as PaymentMethod, applyDiscountId: selectedDiscountId });
      return;
    }
    if (uiPaymentMethod === 'SPLIT_MPESA_CASH') {
      onPayment(order.id, { paymentMethod: 'SPLIT', splitType: 'MPESA_CASH', mpesaCode: mpesaCode.trim(), mpesaAmount: parseFloat(mpesaAmount), cashAmount: parseFloat(cashAmount) });
    } else if (uiPaymentMethod === 'SPLIT_MPESA_CARD') {
      onPayment(order.id, { paymentMethod: 'SPLIT', splitType: 'MPESA_CARD', mpesaCode: mpesaCode.trim(), mpesaAmount: parseFloat(mpesaAmount), cardAmount: parseFloat(cardAmount) });
    } else if (uiPaymentMethod === 'SPLIT_CASH_CARD') {
      onPayment(order.id, { paymentMethod: 'SPLIT', splitType: 'CASH_CARD', cashAmount: parseFloat(cashAmount), cardAmount: parseFloat(cardAmount) });
    } else if (uiPaymentMethod === 'HOUSE_ACCOUNT') {
      onPayment(order.id, { paymentMethod: 'HOUSE_ACCOUNT', houseAccountId: selectedHouseAccountId });
    } else if (uiPaymentMethod === 'CORPORATE_ACCOUNT') {
      onPayment(order.id, { paymentMethod: 'CORPORATE_ACCOUNT', corporateAccountId: selectedCorporateAccountId, corporateEmployeeRef: corporateEmployeeRef.trim() || undefined });
    } else if (uiPaymentMethod === 'CUSTOMER_CREDIT') {
      onPayment(order.id, { paymentMethod: 'CUSTOMER_CREDIT', customerCreditAccountId: selectedCustomerCreditId });
    } else {
      onPayment(order.id, { paymentMethod: uiPaymentMethod as PaymentMethod, mpesaCode: uiPaymentMethod === 'MPESA' ? mpesaCode.trim() : undefined });
    }
  }

  const confirmBtnLabel = (() => {
    if (selectedDiscountId !== null && !order.discountAmount) {
      if (selectedDiscountId === 'staff') return 'Request Discount & Await Approval';
      const d = availableDiscounts.find((x) => x.id === selectedDiscountId);
      return d?.requiresApproval ? 'Request Discount & Await Approval' : 'Apply Discount & Confirm';
    }
    return 'Confirm Payment';
  })();

  // ── Prep ticket helpers ─────────────────────────────────────────────────────
  const stationLabel: Record<string, string> = { KITCHEN: 'Kitchen', BARISTA: 'Barista', PIZZA: 'Pizza', PASTRY: 'Pastry' };

  const statusBg = (s: string) =>
    s === 'READY' ? 'bg-[#EDFAF1]' : s === 'IN_PROGRESS' ? 'bg-[#FEF0E0]' : s === 'REJECTED' ? 'bg-[#FDF2F0]' : 'bg-white';
  const statusColor = (s: string) =>
    s === 'READY' ? 'text-[#1A6B3C]' : s === 'IN_PROGRESS' ? 'text-[#A04F0A]' : s === 'REJECTED' ? 'text-[#9B3A2A]' : 'text-stone-400';
  const dotColor = (s: string) =>
    s === 'READY' ? 'bg-[#86EFAC]' : s === 'IN_PROGRESS' ? 'bg-[#F5B87A]' : s === 'REJECTED' ? 'bg-[#F5A898]' : 'bg-[#F0D080]';

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose} title={`Order #${order.dailyNumber}`}>
        <div className="space-y-5 pb-2">

          {/* ── Order meta card ─────────────────────────────────────────── */}
          <div className="rounded-xl border border-stone-200 bg-[#EDE7DC] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-stone-500">{order.type.replace('_', ' ')}</span>
              {order.tableNumber && (
                <span className="text-[13px] font-semibold text-stone-800">Table {order.tableNumber}</span>
              )}
            </div>
            {order.notes && <p className="text-[13px] text-stone-600">{order.notes}</p>}
            <p className="text-[12px] text-stone-400">
              Placed by <span className="font-medium text-stone-600">{order.createdBy.name}</span>
            </p>
          </div>

          {/* ── Order items ─────────────────────────────────────────────── */}
          <div>
            <SectionLabel>Items</SectionLabel>
            <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 overflow-hidden">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between px-4 py-3 bg-white">
                  <div>
                    <p className="text-[14px] font-medium text-stone-900">
                      {item.quantity} × {item.name}
                    </p>
                    {item.notes && <p className="text-[12px] text-stone-500 mt-0.5">{item.notes}</p>}
                  </div>
                  <p className="text-[14px] font-semibold text-stone-900 whitespace-nowrap">
                    KES {parseFloat(item.subtotal).toLocaleString('en-KE', { minimumFractionDigits: 0 })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Prep tickets ────────────────────────────────────────────── */}
          {order.prepTickets.length > 0 && (
            <div>
              <SectionLabel>Preparation</SectionLabel>
              <div className="rounded-xl border border-stone-200 overflow-hidden divide-y divide-stone-100">
                {order.prepTickets.map((ticket) => {
                  const StationIcon = ticket.station === 'BARISTA' ? Coffee : ChefHat;
                  return (
                    <div key={ticket.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${statusBg(ticket.status)}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`shrink-0 size-1.5 rounded-full ${dotColor(ticket.status)}`} />
                        <StationIcon size={13} className="shrink-0 text-stone-400" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-stone-800 truncate">
                            {ticket.itemLabel || stationLabel[ticket.station] || ticket.station}
                          </p>
                          <p className="text-[11px] text-stone-400">{stationLabel[ticket.station] || ticket.station}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className={`text-[12px] font-semibold ${statusColor(ticket.status)}`}>
                          {ticket.status === 'IN_PROGRESS' ? 'In Progress' : ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase()}
                        </span>
                        {ticket.claimedBy && (
                          <span className="text-[11px] text-stone-400 truncate max-w-[110px]">{ticket.claimedBy.name}</span>
                        )}
                        {ticket.status === 'REJECTED' && ticket.rejectedReason && (
                          <span className="text-[11px] text-[#9B3A2A] truncate max-w-[140px]" title={ticket.rejectedReason}>
                            {ticket.rejectedReason}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Total row ───────────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-t border-stone-200 pt-4">
            <span className="text-[15px] font-semibold text-stone-900">Total</span>
            <span className="text-[18px] font-bold text-stone-900">
              KES {parseFloat(order.total).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* ── Payment summary (already paid) ─────────────────────────── */}
          {isPaid && order.paymentMethod && <PaymentSummary order={order} />}

          {isCancellationPending && (
            <div className="rounded-xl border border-[#FDBA74] bg-[#FFF7ED] p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Clock size={16} className="shrink-0 text-[#9A3412]" />
                <p className="text-[13px] font-semibold text-[#9A3412]">Cancellation Pending Approval</p>
              </div>
              <p className="text-[13px] text-[#9A3412]">
                A manager or director must approve this cancellation before the order is removed.
              </p>
            </div>
          )}

          {/* ── Action buttons (edit / cancel / print bill) ─────────────── */}
          {canEdit && onEdit && (
            <Button variant="secondary" className="w-full" onClick={() => onEdit(order.id)}>
              Edit Order
            </Button>
          )}
          {canCancel && onCancel && (
            <Button variant="destructive" className="w-full" onClick={() => onCancel(order.id)}>
              {isManager ? 'Cancel Order' : 'Request Cancellation'}
            </Button>
          )}
          {canPrintBill && (
            <Button variant="secondary" className="w-full" isLoading={isPrintBillSubmitting} onClick={() => onPrintBill?.(order.id)}>
              <Printer size={16} className="mr-2 shrink-0" />
              Print Bill
            </Button>
          )}

          {/* ── Payment form (order is READY) ───────────────────────────── */}
          {order.status === 'READY' && (
            <div className="space-y-4">
              {order.type === 'DELIVERY' ? (
                /* Delivery — Mpesa only */
                <div className="space-y-3">
                  <Input
                    label="M-Pesa transaction code(s) *"
                    placeholder="e.g. QHG3KL9XPO or QHG3KL9XPO,AR4O8KEO"
                    value={mpesaCode}
                    onChange={(e) => setMpesaCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                  />
                  <p className="text-[12px] text-stone-400">Multiple codes? Separate with commas</p>
                  <Button className="w-full" isLoading={isPaymentSubmitting} disabled={!mpesaCode.trim()}
                    onClick={() => onPayment(order.id, { paymentMethod: 'MPESA', mpesaCode: mpesaCode.trim() })}>
                    Hand to Grubba
                  </Button>
                </div>
              ) : (
                /* Dine-in / Take-away — full method selection */
                <>
                  {/* Guest split panel — shown when GUEST_SPLIT selected */}
                  {uiPaymentMethod === 'GUEST_SPLIT' ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <SectionLabel>Split between guests</SectionLabel>
                        <button
                          type="button"
                          onClick={() => { setUiPaymentMethod('MPESA'); resetPaymentForm(); }}
                          className="text-[12px] text-stone-500 hover:text-stone-700 underline"
                        >
                          ← Back
                        </button>
                      </div>
                      {onAddSplitLine && onDeleteSplitLine ? (
                        <GuestSplitPanel
                          order={order}
                          onAddSplitLine={async (payload) => onAddSplitLine(order.id, payload)}
                          onDeleteSplitLine={async (lineId) => onDeleteSplitLine(order.id, lineId)}
                          onCloseOrder={() => onPayment(order.id, { paymentMethod: 'GUEST_SPLIT' })}
                          isClosingOrder={isPaymentSubmitting}
                        />
                      ) : (
                        <p className="text-[13px] text-stone-500">Guest split is not available for this order.</p>
                      )}
                    </div>
                  ) : (
                    /* Standard payment method selection */
                    <div className="space-y-3">
                      <SectionLabel>Payment method</SectionLabel>

                      {/* Base methods */}
                      <div className="space-y-2">
                        <MethodCard icon="📱" label="M-Pesa" sub="Enter transaction code" selected={uiPaymentMethod === 'MPESA'} onClick={() => { setUiPaymentMethod('MPESA'); resetPaymentForm(); }} />
                        <MethodCard icon="💵" label="Cash" sub="Record cash received" selected={uiPaymentMethod === 'CASH'} onClick={() => { setUiPaymentMethod('CASH'); resetPaymentForm(); }} />
                        <MethodCard icon="💳" label="Card" sub="Tap or swipe" selected={uiPaymentMethod === 'CARD'} onClick={() => { setUiPaymentMethod('CARD'); resetPaymentForm(); }} />
                        <MethodCard icon="🔀" label="Split (2 methods)" sub="One payer, two payment methods" selected={(['SPLIT_MPESA_CASH','SPLIT_MPESA_CARD','SPLIT_CASH_CARD'] as UiPaymentValue[]).includes(uiPaymentMethod)} onClick={() => { setUiPaymentMethod('SPLIT_MPESA_CASH'); resetPaymentForm(); }} />
                        <MethodCard icon="👥" label="Split between guests" sub="Each guest pays their share" selected={false} onClick={() => { setUiPaymentMethod('GUEST_SPLIT'); resetPaymentForm(); }} />
                      </div>

                      {/* Credit methods */}
                      {env.creditAccounts && (
                        <>
                          <Divider />
                          <div className="space-y-2">
                            <MethodCard icon="🏠" label="House Account" sub="Charge to staff benefit account" selected={uiPaymentMethod === 'HOUSE_ACCOUNT'} onClick={() => { setUiPaymentMethod('HOUSE_ACCOUNT'); resetPaymentForm(); }} />
                            <MethodCard icon="🏢" label="Corporate Account" sub="Charge to company account" selected={uiPaymentMethod === 'CORPORATE_ACCOUNT'} onClick={() => { setUiPaymentMethod('CORPORATE_ACCOUNT'); resetPaymentForm(); }} />
                            <MethodCard icon="🪙" label="Customer Credit" sub="Charge to customer tab" selected={uiPaymentMethod === 'CUSTOMER_CREDIT'} onClick={() => { setUiPaymentMethod('CUSTOMER_CREDIT'); resetPaymentForm(); }} />
                          </div>
                        </>
                      )}

                      {/* Method-specific inputs */}
                      {(uiPaymentMethod === 'MPESA' || uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD') && (
                        <div className="space-y-1">
                          <Input
                            label="M-Pesa transaction code(s) *"
                            placeholder="e.g. QHG3KL9XPO"
                            value={mpesaCode}
                            onChange={(e) => setMpesaCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                          />
                          <p className="text-[12px] text-stone-400">Multiple codes? Separate with commas</p>
                        </div>
                      )}

                      {/* Two-method split inputs */}
                      {isMethodSplit && (
                        <div className="rounded-xl border border-stone-200 bg-[#EDE7DC] p-4 space-y-3">
                          {/* Sub-type selector */}
                          <div>
                            <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-stone-500 mb-2">Split type</p>
                            <div className="flex gap-2">
                              {(['SPLIT_MPESA_CASH', 'SPLIT_MPESA_CARD', 'SPLIT_CASH_CARD'] as const).map((v) => {
                                const labels: Record<string, string> = { SPLIT_MPESA_CASH: 'M-Pesa + Cash', SPLIT_MPESA_CARD: 'M-Pesa + Card', SPLIT_CASH_CARD: 'Cash + Card' };
                                return (
                                  <button key={v} type="button" onClick={() => { setUiPaymentMethod(v); setMpesaAmount(''); setCashAmount(''); setCardAmount(''); }}
                                    className={`flex-1 py-2 rounded-lg border-[1.5px] text-[12px] font-medium transition-all ${uiPaymentMethod === v ? 'border-[#2C1810] bg-[#2C1810] text-[#F5F0E8]' : 'border-stone-200 bg-white text-stone-700'}`}>
                                    {labels[v]}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <p className="text-[13px] font-medium text-stone-700">
                            Amounts must total{' '}
                            <span className="text-[#2C1810] font-bold">KES {orderTotal.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
                          </p>

                          <div className="grid grid-cols-2 gap-3">
                            {(uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD') && (
                              <Input label="M-Pesa (KES)" type="number" min="0" step="1" placeholder="0" value={mpesaAmount}
                                onChange={(e) => {
                                  setMpesaAmount(e.target.value);
                                  const first = parseFloat(e.target.value) || 0;
                                  const rem = (orderTotal - first).toFixed(2);
                                  if (orderTotal - first >= 0) {
                                    if (uiPaymentMethod === 'SPLIT_MPESA_CASH') setCashAmount(rem);
                                    else setCardAmount(rem);
                                  }
                                }}
                              />
                            )}
                            {uiPaymentMethod === 'SPLIT_CASH_CARD' && (
                              <Input label="Cash (KES)" type="number" min="0" step="1" placeholder="0" value={cashAmount}
                                onChange={(e) => { setCashAmount(e.target.value); const r = orderTotal - (parseFloat(e.target.value) || 0); if (r >= 0) setCardAmount(r.toFixed(2)); }}
                              />
                            )}
                            {uiPaymentMethod === 'SPLIT_MPESA_CASH' && (
                              <Input label="Cash (KES)" type="number" min="0" step="1" placeholder="0" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} />
                            )}
                            {(uiPaymentMethod === 'SPLIT_MPESA_CARD' || uiPaymentMethod === 'SPLIT_CASH_CARD') && (
                              <Input label="Card (KES)" type="number" min="0" step="1" placeholder="0" value={cardAmount} onChange={(e) => setCardAmount(e.target.value)} />
                            )}
                          </div>
                          {splitErrorMsg && (
                            <p className="text-[12px] text-[#991B1B]">{splitErrorMsg}</p>
                          )}
                        </div>
                      )}

                      {/* House Account selector */}
                      {uiPaymentMethod === 'HOUSE_ACCOUNT' && (
                        <div>
                          <label className="block text-[11px] font-semibold tracking-[0.06em] uppercase text-stone-500 mb-2">Account Holder</label>
                          <select value={selectedHouseAccountId} onChange={(e) => setSelectedHouseAccountId(e.target.value)}
                            className="w-full rounded-xl border-[1.5px] border-stone-200 bg-white px-4 py-3 text-[14px] text-stone-900 focus:outline-none focus:border-[#2C1810]">
                            <option value="">Select account holder…</option>
                            {houseAccounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.userName} — KES {parseFloat(a.currentBalance).toLocaleString()}
                                {a.creditLimit ? ` / ${parseFloat(a.creditLimit).toLocaleString()} limit` : ' (uncapped)'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Corporate Account selector */}
                      {uiPaymentMethod === 'CORPORATE_ACCOUNT' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[11px] font-semibold tracking-[0.06em] uppercase text-stone-500 mb-2">Company</label>
                            <select value={selectedCorporateAccountId} onChange={(e) => setSelectedCorporateAccountId(e.target.value)}
                              className="w-full rounded-xl border-[1.5px] border-stone-200 bg-white px-4 py-3 text-[14px] text-stone-900 focus:outline-none focus:border-[#2C1810]">
                              <option value="">Select company…</option>
                              {corporateAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.companyName}
                                  {a.creditLimit
                                    ? ` — KES ${parseFloat(a.currentBalance).toLocaleString()} / ${parseFloat(a.creditLimit).toLocaleString()} limit`
                                    : ` — KES ${parseFloat(a.currentBalance).toLocaleString()} (uncapped)`}
                                </option>
                              ))}
                            </select>
                          </div>
                          <Input label="Employee reference (optional)" placeholder="e.g. staff ID or name"
                            value={corporateEmployeeRef} onChange={(e) => setCorporateEmployeeRef(e.target.value)} />
                        </div>
                      )}

                      {/* Customer Credit selector */}
                      {uiPaymentMethod === 'CUSTOMER_CREDIT' && (
                        <div className="space-y-2">
                          {!showNewCustomerForm && (
                            <>
                              <div>
                                <label className="block text-[11px] font-semibold tracking-[0.06em] uppercase text-stone-500 mb-2">Customer Account</label>
                                <select value={selectedCustomerCreditId} onChange={(e) => setSelectedCustomerCreditId(e.target.value)}
                                  className="w-full rounded-xl border-[1.5px] border-stone-200 bg-white px-4 py-3 text-[14px] text-stone-900 focus:outline-none focus:border-[#2C1810]">
                                  <option value="">Select customer…</option>
                                  {customerCreditAccounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.customerName} ({a.customerPhone}) — KES {parseFloat(a.currentBalance).toLocaleString()} / {parseFloat(a.creditLimit).toLocaleString()} limit
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {onCreateCustomerCredit && (
                                <button type="button"
                                  className="flex items-center gap-1.5 text-[13px] font-medium text-[#2C1810] hover:underline"
                                  onClick={() => { setShowNewCustomerForm(true); setSelectedCustomerCreditId(''); }}>
                                  <Plus size={14} />
                                  New customer account
                                </button>
                              )}
                            </>
                          )}

                          {showNewCustomerForm && onCreateCustomerCredit && (
                            <div className="rounded-xl border border-stone-200 bg-[#EDE7DC] p-4 space-y-3">
                              <p className="text-[13px] font-semibold text-stone-700">New Customer Credit Account</p>
                              <Input label="Customer Name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="e.g. Grace Wanjiku" disabled={isCreatingCustomer} />
                              <Input label="Phone" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} placeholder="e.g. 0712345678" disabled={isCreatingCustomer} />
                              <Input label="Credit Limit (KES)" type="number" min="0.01" step="0.01" value={newCustomerLimit} onChange={(e) => setNewCustomerLimit(e.target.value)} placeholder="e.g. 2000.00" disabled={isCreatingCustomer} />
                              <div className="flex gap-2">
                                <Button size="sm" isLoading={isCreatingCustomer}
                                  onClick={() => {
                                    const name = newCustomerName.trim();
                                    const phone = newCustomerPhone.trim();
                                    const limit = newCustomerLimit.trim();
                                    if (!name || !phone || !limit) return;
                                    setIsCreatingCustomer(true);
                                    onCreateCustomerCredit(name, phone, limit)
                                      .then((id) => { setSelectedCustomerCreditId(id); setShowNewCustomerForm(false); setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerLimit(''); })
                                      .catch(() => undefined)
                                      .finally(() => setIsCreatingCustomer(false));
                                  }}>
                                  Create Account
                                </Button>
                                <Button size="sm" variant="secondary" disabled={isCreatingCustomer} onClick={() => setShowNewCustomerForm(false)}>Cancel</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Discount picker */}
                      {!order.discountAmount &&
                        uiPaymentMethod !== 'HOUSE_ACCOUNT' &&
                        uiPaymentMethod !== 'CORPORATE_ACCOUNT' &&
                        uiPaymentMethod !== 'CUSTOMER_CREDIT' &&
                        (isOwner || availableDiscounts.length > 0) && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold tracking-[0.06em] uppercase text-stone-500">Apply Discount</p>
                          <select
                            value={selectedDiscountId ?? ''}
                            onChange={(e) => setSelectedDiscountId(e.target.value === '' ? null : e.target.value)}
                            className="w-full rounded-xl border-[1.5px] border-stone-200 bg-white px-4 py-3 text-[14px] text-stone-900 focus:outline-none focus:border-[#2C1810]"
                          >
                            <option value="">No discount</option>
                            {isOwner && <option value="staff">Staff Discount (30%) — needs approval</option>}
                            {availableDiscounts.map((d) => {
                              const valueLabel = d.type === 'PERCENTAGE' ? `${d.value}%` : `KES ${d.value}`;
                              return <option key={d.id} value={d.id}>{d.name} ({valueLabel}) — {d.requiresApproval ? 'needs approval' : 'instant'}</option>;
                            })}
                          </select>
                        </div>
                      )}

                      {/* Discount preview */}
                      {selectedDiscountId !== null && !order.discountAmount && (() => {
                        const isStaff = selectedDiscountId === 'staff';
                        const customerDiscount = isStaff ? null : availableDiscounts.find((d) => d.id === selectedDiscountId);
                        const savedAmount = isStaff
                          ? (orderTotal * 0.3).toFixed(2)
                          : customerDiscount
                          ? customerDiscount.type === 'PERCENTAGE'
                            ? ((orderTotal * parseFloat(customerDiscount.value)) / 100).toFixed(2)
                            : Math.min(parseFloat(customerDiscount.value), orderTotal).toFixed(2)
                          : '0.00';
                        const discountedTotal = (orderTotal - parseFloat(savedAmount)).toFixed(2);
                        const needsApproval = isStaff || (customerDiscount?.requiresApproval ?? false);
                        return (
                          <div className="rounded-xl border border-[#F0C97A] bg-[#FFFBEB] p-4 space-y-1">
                            <p className="text-[13px] font-semibold text-[#92400E]">Discounted total: KES {discountedTotal}</p>
                            <p className="text-[12px] text-[#92400E]">
                              Saving KES {savedAmount}
                              {needsApproval ? ' — manager approval required.' : ' — applied immediately.'}
                            </p>
                          </div>
                        );
                      })()}

                      {/* Discount applied */}
                      {order.discountAmount && (
                        <div className="rounded-xl border border-[#86EFAC] bg-[#EDFAF1] p-4 space-y-1">
                          <p className="text-[13px] font-semibold text-[#1A6B3C]">
                            Discount Applied — Total: KES {parseFloat(order.total).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[12px] text-[#1A6B3C]">Discount approved. Collect payment at the discounted amount.</p>
                        </div>
                      )}

                      {/* Confirm button */}
                      <button
                        type="button"
                        disabled={confirmDisabled || isPaymentSubmitting}
                        onClick={handleConfirmPayment}
                        className="w-full py-4 rounded-[14px] font-semibold text-[15px] tracking-[0.02em] transition-all disabled:bg-stone-200 disabled:text-stone-400 bg-[#2C1810] text-[#F5F0E8] hover:bg-[#4A2C1A]"
                      >
                        {isPaymentSubmitting ? 'Recording payment…' : confirmBtnLabel}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── AWAITING_AUTHORIZATION states ───────────────────────────── */}

          {/* Staff discount pending */}
          {order.status === 'AWAITING_AUTHORIZATION' && pendingStaffDiscountRequestId && (
            <div className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#92400E] shrink-0" />
                <p className="text-[13px] font-semibold text-[#92400E]">Awaiting Discount Approval</p>
              </div>
              <p className="text-[13px] text-[#92400E]">A 30% staff discount has been requested. A manager must approve before payment can be collected.</p>
              {isManager && onStaffDiscountOverride && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1" isLoading={isStaffDiscountOverrideSubmitting} onClick={() => onStaffDiscountOverride(order.id, 'APPROVED')}>Approve Discount</Button>
                  <Button size="sm" variant="destructive" className="flex-1" isLoading={isStaffDiscountOverrideSubmitting} onClick={() => onStaffDiscountOverride(order.id, 'REJECTED')}>Reject</Button>
                </div>
              )}
            </div>
          )}

          {/* Customer discount pending */}
          {order.status === 'AWAITING_AUTHORIZATION' && pendingCustomerDiscountRequestId && (
            <div className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[#92400E] shrink-0" />
                <p className="text-[13px] font-semibold text-[#92400E]">Awaiting Discount Approval</p>
              </div>
              <p className="text-[13px] text-[#92400E]">
                A{pendingCustomerDiscountName ? ` "${pendingCustomerDiscountName}"` : ''} discount has been requested. A manager must approve before payment can be collected.
              </p>
              {isManager && onCustomerDiscountOverride && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1" isLoading={isCustomerDiscountOverrideSubmitting} onClick={() => onCustomerDiscountOverride(order.id, 'APPROVED')}>Approve Discount</Button>
                  <Button size="sm" variant="destructive" className="flex-1" isLoading={isCustomerDiscountOverrideSubmitting} onClick={() => onCustomerDiscountOverride(order.id, 'REJECTED')}>Reject</Button>
                </div>
              )}
            </div>
          )}

          {/* House account pending */}
          {order.status === 'AWAITING_AUTHORIZATION' && !pendingStaffDiscountRequestId && !pendingCustomerDiscountRequestId && (() => {
            const isExpired = pendingAuthExpiresAt ? new Date(pendingAuthExpiresAt) < new Date() : false;
            return (
              <div className={`rounded-xl border p-4 space-y-3 ${isExpired ? 'border-[#FCA5A5] bg-[#FEF2F2]' : 'border-[#FCD34D] bg-[#FFFBEB]'}`}>
                <div className="flex items-center gap-2">
                  <Clock size={16} className={isExpired ? 'text-[#991B1B] shrink-0' : 'text-[#92400E] shrink-0'} />
                  <p className={`text-[13px] font-semibold ${isExpired ? 'text-[#991B1B]' : 'text-[#92400E]'}`}>
                    {isExpired ? 'Authorization Expired' : 'Awaiting Authorization'}
                  </p>
                </div>
                {isExpired ? (
                  <p className="text-[13px] text-[#991B1B]">
                    The charge request to <span className="font-medium">{pendingAuthHolderName ?? 'the account holder'}</span> has expired. A manager must return this order to Ready.
                  </p>
                ) : (
                  <p className="text-[13px] text-[#92400E]">
                    A charge request has been sent to{' '}
                    <span className="font-medium">{pendingAuthHolderName ?? 'the account holder'}</span>.{' '}
                    The order will close automatically once approved.
                  </p>
                )}
                {isManager && pendingAuthRequestId && (
                  isExpired ? (
                    onAuthForceExpire && (
                      <Button size="sm" variant="secondary" className="w-full" isLoading={isAuthOverrideSubmitting} onClick={() => onAuthForceExpire(order.id)}>
                        Return Order to Ready
                      </Button>
                    )
                  ) : (
                    onAuthOverride && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="flex-1" isLoading={isAuthOverrideSubmitting} onClick={() => onAuthOverride(order.id, 'APPROVED')}>Approve</Button>
                        <Button size="sm" variant="destructive" className="flex-1" isLoading={isAuthOverrideSubmitting} onClick={() => onAuthOverride(order.id, 'REJECTED')}>Reject</Button>
                      </div>
                    )
                  )
                )}
              </div>
            );
          })()}

          {/* ── Print receipt (after payment) ───────────────────────────── */}
          {isPaid && onPrintReceipt && (
            <Button variant="secondary" className="w-full" isLoading={isPrintSubmitting} onClick={() => setIsReprintConfirmOpen(true)}>
              <Printer size={16} className="mr-2 shrink-0" />
              Print Receipt
            </Button>
          )}
        </div>
      </BottomSheet>

      {/* Reprint confirmation */}
      <BottomSheet isOpen={isReprintConfirmOpen} onClose={() => setIsReprintConfirmOpen(false)} title="Print Receipt?">
        <div className="space-y-4">
          <p className="text-[14px] text-stone-700">This will print 2 copies (customer + accountant). If you already printed this receipt, it will print again.</p>
          <Button className="w-full" onClick={() => { setIsReprintConfirmOpen(false); onPrintReceipt?.(order.id); }}>Yes, Print</Button>
          <Button variant="secondary" className="w-full" onClick={() => setIsReprintConfirmOpen(false)}>Cancel</Button>
        </div>
      </BottomSheet>
    </>
  );
}
