'use client';

import { useState } from 'react';
import { Printer, ChefHat, Coffee, User, Plus, Clock } from 'lucide-react';
import { BottomSheet, Button, Input, PriceDisplay, Select } from '@/components/ui';
import { env } from '@/lib/env';
import type { OrderDetail, PaymentMethod } from '@/types/order';
import type { HouseAccountDropdownItem } from '@/services/houseAccountService';
import type { CorporateAccountDropdownItem } from '@/services/corporateAccountService';
import type { CustomerCreditDropdownItem } from '@/services/customerCreditService';
import type { Discount } from '@/types/discount';

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
  // Staff discount props
  pendingStaffDiscountRequestId?: string;
  onStaffDiscountOverride?: (orderId: string, decision: 'APPROVED' | 'REJECTED') => void;
  isStaffDiscountOverrideSubmitting?: boolean;
  // Customer discount props
  availableDiscounts?: Discount[];
  pendingCustomerDiscountRequestId?: string;
  pendingCustomerDiscountName?: string;
  onCustomerDiscountOverride?: (orderId: string, decision: 'APPROVED' | 'REJECTED') => void;
  isCustomerDiscountOverrideSubmitting?: boolean;
}

// UI-level split type options — all resolve to paymentMethod: SPLIT on submit
type UiPaymentValue = PaymentMethod | 'SPLIT_MPESA_CASH' | 'SPLIT_MPESA_CARD' | 'SPLIT_CASH_CARD';

const BASE_PAYMENT_OPTIONS: Array<{ value: UiPaymentValue; label: string }> = [
  { value: 'MPESA', label: 'Mpesa' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'SPLIT_MPESA_CASH', label: 'Split: Mpesa + Cash' },
  { value: 'SPLIT_MPESA_CARD', label: 'Split: Mpesa + Card' },
  { value: 'SPLIT_CASH_CARD', label: 'Split: Cash + Card' },
];

const CREDIT_PAYMENT_OPTIONS = [
  { value: 'HOUSE_ACCOUNT', label: 'House Account' },
  { value: 'CORPORATE_ACCOUNT', label: 'Corporate Account' },
  { value: 'CUSTOMER_CREDIT', label: 'Customer Credit' },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  MPESA: 'M-Pesa',
  CASH: 'Cash',
  CARD: 'Card',
  SPLIT: 'Split',
  HOUSE_ACCOUNT: 'House Account',
  CORPORATE_ACCOUNT: 'Corporate Account',
  CUSTOMER_CREDIT: 'Customer Credit',
};

function PaymentSummary({ order }: { order: OrderDetail }): JSX.Element {
  const method = order.paymentMethod;
  if (!method) return <></>;

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

  const Row = ({ title, value }: { title: string; value: string }): JSX.Element => (
    <div className="flex items-center justify-between">
      <span className="text-body-sm text-stone-500">{title}</span>
      <span className="text-body-sm font-medium text-stone-800">{value}</span>
    </div>
  );

  return (
    <div className="space-y-1">
      <Row title="Method" value={label} />
      {method === 'MPESA' && order.mpesaCode && <Row title="M-Pesa Code" value={order.mpesaCode} />}
      {method === 'MPESA' && order.mpesaAmount && (
        <Row title="M-Pesa Amount" value={`KES ${Number.parseFloat(order.mpesaAmount).toFixed(2)}`} />
      )}
      {method === 'CASH' && order.cashAmount && (
        <Row title="Cash Amount" value={`KES ${Number.parseFloat(order.cashAmount).toFixed(2)}`} />
      )}
      {method === 'CARD' && order.cardAmount && (
        <Row title="Card Amount" value={`KES ${Number.parseFloat(order.cardAmount).toFixed(2)}`} />
      )}
      {method === 'SPLIT' && (
        <>
          {order.mpesaAmount && Number.parseFloat(order.mpesaAmount) > 0 && (
            <Row title="M-Pesa" value={`KES ${Number.parseFloat(order.mpesaAmount).toFixed(2)}`} />
          )}
          {order.cashAmount && Number.parseFloat(order.cashAmount) > 0 && (
            <Row title="Cash" value={`KES ${Number.parseFloat(order.cashAmount).toFixed(2)}`} />
          )}
          {order.cardAmount && Number.parseFloat(order.cardAmount) > 0 && (
            <Row title="Card" value={`KES ${Number.parseFloat(order.cardAmount).toFixed(2)}`} />
          )}
        </>
      )}
      {order.discountAmount && (
        <>
          <Row
            title={order.discountId ? 'Customer Discount' : 'Staff Discount'}
            value={
              order.discountPercent
                ? `${Number.parseFloat(order.discountPercent).toFixed(0)}%`
                : `KES ${Number.parseFloat(order.discountAmount).toFixed(2)}`
            }
          />
          <Row title="Saved" value={`KES ${Number.parseFloat(order.discountAmount).toFixed(2)}`} />
        </>
      )}
      {paidAt && <Row title="Paid at" value={paidAt} />}
    </div>
  );
}

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
}: OrderDetailBottomSheetProps) {
  const [uiPaymentMethod, setUiPaymentMethod] = useState<UiPaymentValue>('MPESA');
  const [mpesaCode, setMpesaCode] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [isReprintConfirmOpen, setIsReprintConfirmOpen] = useState(false);
  // 'staff' = staff discount; a discount UUID = customer discount; null = no discount
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(null);

  // Credit account selectors
  const [selectedHouseAccountId, setSelectedHouseAccountId] = useState('');
  const [selectedCorporateAccountId, setSelectedCorporateAccountId] = useState('');
  const [corporateEmployeeRef, setCorporateEmployeeRef] = useState('');
  const [selectedCustomerCreditId, setSelectedCustomerCreditId] = useState('');

  // Inline new customer credit form
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerLimit, setNewCustomerLimit] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  const canEdit =
    (isOwner || isManager) &&
    order?.status !== 'CLOSED' &&
    order?.status !== 'CANCELLED' &&
    order?.status !== 'AWAITING_AUTHORIZATION';
  const isPaid = Boolean(order?.paymentMethod);
  const canCancel =
    (isOwner && order?.status !== 'CLOSED' && order?.status !== 'CANCELLED' && order?.status !== 'AWAITING_AUTHORIZATION') ||
    (isManager && order?.status !== 'CLOSED' && order?.status !== 'CANCELLED' && order?.status !== 'AWAITING_AUTHORIZATION');

  // Bill button visible once order is no longer pending (prep has started or is done)
  const canPrintBill =
    Boolean(onPrintBill) &&
    !isPaid &&
    order?.status !== 'PENDING' &&
    order?.status !== 'CANCELLED';

  if (!order) {
    return null;
  }

  const handleReprintClick = () => {
    setIsReprintConfirmOpen(true);
  };

  const handleReprintConfirm = () => {
    setIsReprintConfirmOpen(false);
    onPrintReceipt?.(order.id);
  };

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose} title={`Order #${order.dailyNumber}`}>
        <div className="space-y-4">
          <div className="rounded-md border border-stone-200 p-3 space-y-1">
            <p className="text-body-sm text-stone-500">{order.type.replace('_', ' ')}</p>
            {order.tableNumber && <p className="text-body-md text-stone-900">Table {order.tableNumber}</p>}
            {order.notes && <p className="text-body-sm text-stone-700">{order.notes}</p>}
            <div className="flex items-center gap-1.5 pt-0.5">
              <User size={12} className="text-stone-400 shrink-0" />
              <span className="text-label-sm text-stone-400">Placed by</span>
              <span className="text-label-sm font-medium text-stone-700">{order.createdBy.name}</span>
            </div>
          </div>

          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="rounded-md border border-stone-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-body-md text-stone-900">
                    {item.quantity} x {item.name}
                  </p>
                  <PriceDisplay amount={Number.parseFloat(item.subtotal)} />
                </div>
                <p className="text-body-sm text-stone-500">Unit: KES {Number.parseFloat(item.unitPrice).toFixed(2)}</p>
                {item.notes && <p className="text-body-sm text-stone-600">{item.notes}</p>}
              </div>
            ))}
          </div>

          {order.prepTickets.length > 0 && (
            <div className="rounded-lg border border-stone-200 overflow-hidden">
              <p className="px-3 py-2 text-label-sm font-semibold text-stone-500 uppercase tracking-wide bg-stone-50 border-b border-stone-200">
                Preparation
              </p>
              <div className="divide-y divide-stone-100">
                {order.prepTickets.map((ticket) => {
                  const isRejected = ticket.status === 'REJECTED';
                  const isReady = ticket.status === 'READY';
                  const isInProgress = ticket.status === 'IN_PROGRESS';
                  const StationIcon = ticket.station === 'BARISTA' ? Coffee : ChefHat;

                  const rowBg = isRejected
                    ? 'bg-[#FDF2F0]'
                    : isReady
                      ? 'bg-[#EDFAF1]'
                      : isInProgress
                        ? 'bg-[#FEF0E0]'
                        : 'bg-white';

                  const statusTextColour = isRejected
                    ? 'text-[#9B3A2A]'
                    : isReady
                      ? 'text-[#1A6B3C]'
                      : isInProgress
                        ? 'text-[#A04F0A]'
                        : 'text-stone-400';

                  const dotColour = isRejected
                    ? 'bg-[#F5A898]'
                    : isReady
                      ? 'bg-[#86EFAC]'
                      : isInProgress
                        ? 'bg-[#F5B87A]'
                        : 'bg-[#F0D080]';

                  const statusLabel = isInProgress
                    ? 'In Progress'
                    : ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase();

                  const stationLabel: Record<string, string> = {
                    KITCHEN: 'Kitchen',
                    BARISTA: 'Barista',
                    PIZZA: 'Pizza',
                    PASTRY: 'Pastry',
                  };

                  return (
                    <div
                      key={ticket.id}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 ${rowBg}`}
                    >
                      {/* Left: item label + station */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`shrink-0 size-1.5 rounded-full ${dotColour}`} />
                        <StationIcon size={13} className="shrink-0 text-stone-400" />
                        <div className="min-w-0">
                          <p className="text-label-sm font-semibold text-stone-800 truncate">
                            {ticket.itemLabel || stationLabel[ticket.station] || ticket.station}
                          </p>
                          <p className="text-caption text-stone-400">
                            {stationLabel[ticket.station] || ticket.station}
                          </p>
                        </div>
                      </div>

                      {/* Right: status + who claimed it */}
                      <div className="flex flex-col items-end gap-0.5 shrink-0">
                        <span className={`text-label-sm font-semibold ${statusTextColour}`}>
                          {statusLabel}
                        </span>
                        {ticket.claimedBy && (
                          <span className="text-caption text-stone-400 truncate max-w-[110px]">
                            {ticket.claimedBy.name}
                          </span>
                        )}
                        {isRejected && ticket.rejectedReason && (
                          <span
                            className="text-caption text-[#9B3A2A] truncate max-w-[140px]"
                            title={ticket.rejectedReason}
                          >
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

          <div className="flex items-center justify-between border-t border-stone-200 pt-3 mb-4">
            <span className="text-body-md font-semibold text-stone-900">Total</span>
            <PriceDisplay amount={Number.parseFloat(order.total)} />
          </div>

          {isPaid && order.paymentMethod && (
            <div className="rounded-md border border-stone-200 bg-stone-50 p-3 space-y-1.5">
              <p className="text-body-sm font-semibold text-stone-500 uppercase tracking-wide">Payment</p>
              <PaymentSummary order={order} />
            </div>
          )}

          {canEdit && onEdit && (
            <Button variant="secondary" className="w-full" onClick={() => onEdit(order.id)}>
              Edit Order
            </Button>
          )}

          {canCancel && onCancel && (
            <Button variant="destructive" className="w-full" onClick={() => onCancel(order.id)}>
              Cancel Order
            </Button>
          )}

          {canPrintBill && (
            <Button
              variant="secondary"
              className="w-full"
              isLoading={isPrintBillSubmitting}
              onClick={() => onPrintBill?.(order.id)}
            >
              <Printer size={16} className="mr-2 shrink-0" />
              Print Bill
            </Button>
          )}

          {order.status === 'READY' && (
            <div className="space-y-3">
              {order.type === 'DELIVERY' ? (
                <div className="space-y-3">
                  <Input
                    label="Mpesa transaction code"
                    placeholder="e.g. QHG3KL9XPO"
                    value={mpesaCode}
                    onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                  />
                  <Button
                    className="w-full"
                    isLoading={isPaymentSubmitting}
                    disabled={!mpesaCode.trim()}
                    onClick={() => onPayment(order.id, { paymentMethod: 'MPESA', mpesaCode: mpesaCode.trim() })}
                  >
                    Hand to Grubba
                  </Button>
                </div>
              ) : (
                <>
                  <Select
                    label="Payment method"
                    options={env.creditAccounts ? [...BASE_PAYMENT_OPTIONS, ...CREDIT_PAYMENT_OPTIONS] : BASE_PAYMENT_OPTIONS}
                    value={uiPaymentMethod}
                    onChange={(event) => {
                      setUiPaymentMethod(event.target.value as UiPaymentValue);
                      setMpesaCode('');
                      setMpesaAmount('');
                      setCashAmount('');
                      setCardAmount('');
                      setSelectedHouseAccountId('');
                      setSelectedCorporateAccountId('');
                      setCorporateEmployeeRef('');
                      setSelectedCustomerCreditId('');
                      setShowNewCustomerForm(false);
                    }}
                  />

                  {/* Mpesa transaction code — shown for MPESA and split types that include Mpesa */}
                  {(uiPaymentMethod === 'MPESA' || uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD') && (
                    <Input
                      label="Mpesa transaction code"
                      placeholder="e.g. QHG3KL9XPO"
                      value={mpesaCode}
                      onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                    />
                  )}

                  {/* Split payment amount inputs */}
                  {(uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD' || uiPaymentMethod === 'SPLIT_CASH_CARD') && (
                    <div className="rounded-md border border-stone-200 p-3 space-y-3">
                      <p className="text-label-sm font-medium text-stone-700">
                        Split amounts must total{' '}
                        <span className="text-espresso font-semibold">
                          KES {Number.parseFloat(order.total).toFixed(2)}
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {/* First amount field */}
                        {(uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD') && (
                          <Input
                            label="Mpesa amount (KES)"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={mpesaAmount}
                            onChange={(e) => {
                              setMpesaAmount(e.target.value);
                              const total = Number.parseFloat(order.total);
                              const first = Number.parseFloat(e.target.value) || 0;
                              const remainder = (total - first).toFixed(2);
                              if (total - first >= 0) {
                                if (uiPaymentMethod === 'SPLIT_MPESA_CASH') setCashAmount(remainder);
                                else setCardAmount(remainder);
                              }
                            }}
                          />
                        )}
                        {uiPaymentMethod === 'SPLIT_CASH_CARD' && (
                          <Input
                            label="Cash amount (KES)"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={cashAmount}
                            onChange={(e) => {
                              setCashAmount(e.target.value);
                              const total = Number.parseFloat(order.total);
                              const first = Number.parseFloat(e.target.value) || 0;
                              const remainder = total - first;
                              if (remainder >= 0) setCardAmount(remainder.toFixed(2));
                            }}
                          />
                        )}
                        {/* Second amount field */}
                        {uiPaymentMethod === 'SPLIT_MPESA_CASH' && (
                          <Input
                            label="Cash amount (KES)"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={cashAmount}
                            onChange={(e) => setCashAmount(e.target.value)}
                          />
                        )}
                        {(uiPaymentMethod === 'SPLIT_MPESA_CARD' || uiPaymentMethod === 'SPLIT_CASH_CARD') && (
                          <Input
                            label="Card amount (KES)"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="0"
                            value={cardAmount}
                            onChange={(e) => setCardAmount(e.target.value)}
                          />
                        )}
                      </div>
                      {(() => {
                        const total = Number.parseFloat(order.total);
                        const a1 = uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD'
                          ? (Number.parseFloat(mpesaAmount) || 0)
                          : (Number.parseFloat(cashAmount) || 0);
                        const a2 = uiPaymentMethod === 'SPLIT_MPESA_CASH'
                          ? (Number.parseFloat(cashAmount) || 0)
                          : (Number.parseFloat(cardAmount) || 0);
                        const diff = Math.abs(a1 + a2 - total);
                        if ((a1 > 0 || a2 > 0) && diff > 1) {
                          return (
                            <p className="text-caption text-red-600">
                              Amounts total KES {(a1 + a2).toFixed(2)} — must equal KES {total.toFixed(2)}
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}

                  {/* House Account selector */}
                  {uiPaymentMethod === 'HOUSE_ACCOUNT' && (
                    <div>
                      <label className="mb-1.5 block text-label-sm font-medium text-stone-700">Account Holder</label>
                      <select
                        value={selectedHouseAccountId}
                        onChange={(e) => setSelectedHouseAccountId(e.target.value)}
                        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-body-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-espresso/30"
                      >
                        <option value="">Select account holder…</option>
                        {houseAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.userName} — KES {Number.parseFloat(a.currentBalance).toLocaleString()}
                            {a.creditLimit ? ` / ${Number.parseFloat(a.creditLimit).toLocaleString()} limit` : ' (uncapped)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Corporate Account selector */}
                  {uiPaymentMethod === 'CORPORATE_ACCOUNT' && (
                    <>
                      <div>
                        <label className="mb-1.5 block text-label-sm font-medium text-stone-700">Company</label>
                        <select
                          value={selectedCorporateAccountId}
                          onChange={(e) => setSelectedCorporateAccountId(e.target.value)}
                          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-body-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-espresso/30"
                        >
                          <option value="">Select company…</option>
                          {corporateAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.companyName}
                              {a.creditLimit
                                ? ` — KES ${Number.parseFloat(a.currentBalance).toLocaleString()} / ${Number.parseFloat(a.creditLimit).toLocaleString()} limit`
                                : ` — KES ${Number.parseFloat(a.currentBalance).toLocaleString()} (uncapped)`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Input
                        label="Employee reference (optional)"
                        placeholder="e.g. staff ID or name"
                        value={corporateEmployeeRef}
                        onChange={(e) => setCorporateEmployeeRef(e.target.value)}
                      />
                    </>
                  )}

                  {/* Customer Credit selector */}
                  {uiPaymentMethod === 'CUSTOMER_CREDIT' && (
                    <div className="space-y-2">
                      {!showNewCustomerForm && (
                        <>
                          <div>
                            <label className="mb-1.5 block text-label-sm font-medium text-stone-700">Customer Account</label>
                            <select
                              value={selectedCustomerCreditId}
                              onChange={(e) => setSelectedCustomerCreditId(e.target.value)}
                              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-body-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-espresso/30"
                            >
                              <option value="">Select customer…</option>
                              {customerCreditAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.customerName} ({a.customerPhone}) — KES {Number.parseFloat(a.currentBalance).toLocaleString()} / {Number.parseFloat(a.creditLimit).toLocaleString()} limit
                                </option>
                              ))}
                            </select>
                          </div>
                          {onCreateCustomerCredit && (
                            <button
                              type="button"
                              className="flex items-center gap-1.5 text-label-sm font-medium text-espresso hover:underline"
                              onClick={() => {
                                setShowNewCustomerForm(true);
                                setSelectedCustomerCreditId('');
                              }}
                            >
                              <Plus size={14} />
                              New customer account
                            </button>
                          )}
                        </>
                      )}

                      {showNewCustomerForm && onCreateCustomerCredit && (
                        <div className="rounded-md border border-stone-200 p-3 space-y-3">
                          <p className="text-label-sm font-semibold text-stone-700">New Customer Credit Account</p>
                          <Input
                            label="Customer Name"
                            value={newCustomerName}
                            onChange={(e) => setNewCustomerName(e.target.value)}
                            placeholder="e.g. Grace Wanjiku"
                            disabled={isCreatingCustomer}
                          />
                          <Input
                            label="Phone"
                            value={newCustomerPhone}
                            onChange={(e) => setNewCustomerPhone(e.target.value)}
                            placeholder="e.g. 0712345678"
                            disabled={isCreatingCustomer}
                          />
                          <Input
                            label="Credit Limit (KES)"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={newCustomerLimit}
                            onChange={(e) => setNewCustomerLimit(e.target.value)}
                            placeholder="e.g. 2000.00"
                            disabled={isCreatingCustomer}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              isLoading={isCreatingCustomer}
                              onClick={() => {
                                const name = newCustomerName.trim();
                                const phone = newCustomerPhone.trim();
                                const limit = newCustomerLimit.trim();
                                if (!name || !phone || !limit) return;
                                setIsCreatingCustomer(true);
                                onCreateCustomerCredit(name, phone, limit)
                                  .then((id) => {
                                    setSelectedCustomerCreditId(id);
                                    setShowNewCustomerForm(false);
                                    setNewCustomerName('');
                                    setNewCustomerPhone('');
                                    setNewCustomerLimit('');
                                  })
                                  .catch(() => undefined)
                                  .finally(() => setIsCreatingCustomer(false));
                              }}
                            >
                              Create Account
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isCreatingCustomer}
                              onClick={() => setShowNewCustomerForm(false)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Discount Picker — compact dropdown, shown when no discount applied, non-credit payment */}
                  {!order.discountAmount &&
                    uiPaymentMethod !== 'HOUSE_ACCOUNT' &&
                    uiPaymentMethod !== 'CORPORATE_ACCOUNT' &&
                    uiPaymentMethod !== 'CUSTOMER_CREDIT' &&
                    (isOwner || availableDiscounts.length > 0) && (
                    <div className="space-y-1">
                      <p className="text-label-sm font-medium text-stone-700">Apply Discount</p>
                      <Select
                        value={selectedDiscountId ?? ''}
                        onChange={(e) => setSelectedDiscountId(e.target.value === '' ? null : e.target.value)}
                        options={[
                          { value: '', label: 'No discount' },
                          ...(isOwner ? [{ value: 'staff', label: 'Staff Discount (30%) — needs approval' }] : []),
                          ...availableDiscounts.map((d) => {
                            const valueLabel = d.type === 'PERCENTAGE' ? `${d.value}%` : `KES ${d.value}`;
                            const suffix = d.requiresApproval ? 'needs approval' : 'instant';
                            return { value: d.id, label: `${d.name} (${valueLabel}) — ${suffix}` };
                          }),
                        ]}
                      />
                    </div>
                  )}

                  {/* Discount preview card — shows when a discount is selected but not yet applied */}
                  {selectedDiscountId !== null && !order.discountAmount && (() => {
                    const isStaff = selectedDiscountId === 'staff';
                    const customerDiscount = isStaff
                      ? null
                      : availableDiscounts.find((d) => d.id === selectedDiscountId);
                    const savedAmount = isStaff
                      ? (Number.parseFloat(order.total) * 0.3).toFixed(2)
                      : customerDiscount
                      ? customerDiscount.type === 'PERCENTAGE'
                        ? (
                            (Number.parseFloat(order.total) * Number.parseFloat(customerDiscount.value)) /
                            100
                          ).toFixed(2)
                        : Math.min(
                            Number.parseFloat(customerDiscount.value),
                            Number.parseFloat(order.total),
                          ).toFixed(2)
                      : '0.00';
                    const discountedTotal = (
                      Number.parseFloat(order.total) - Number.parseFloat(savedAmount)
                    ).toFixed(2);
                    const needsApproval =
                      isStaff || (customerDiscount?.requiresApproval ?? false);
                    return (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1">
                        <p className="text-label-sm font-medium text-amber-800">
                          Discounted total: KES {discountedTotal}
                        </p>
                        <p className="text-caption text-amber-700">
                          Saving KES {savedAmount}
                          {needsApproval
                            ? ' — a manager must approve before you can collect payment.'
                            : ' — discount will be applied immediately.'}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Discount applied confirmation */}
                  {order.discountAmount && (
                    <div className="rounded-md border border-green-200 bg-green-50 p-3 space-y-1">
                      <p className="text-label-sm font-medium text-green-800">
                        Discount Applied — Total: KES {Number.parseFloat(order.total).toFixed(2)}
                      </p>
                      <p className="text-caption text-green-700">
                        Discount approved. Please collect payment at the discounted amount above.
                      </p>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    isLoading={isPaymentSubmitting}
                    disabled={
                      (uiPaymentMethod === 'MPESA' && !mpesaCode.trim()) ||
                      ((uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD') && !mpesaCode.trim()) ||
                      ((uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD' || uiPaymentMethod === 'SPLIT_CASH_CARD') &&
                        (() => {
                          const total = Number.parseFloat(order.total);
                          const a1 = uiPaymentMethod === 'SPLIT_MPESA_CASH' || uiPaymentMethod === 'SPLIT_MPESA_CARD'
                            ? (Number.parseFloat(mpesaAmount) || 0)
                            : (Number.parseFloat(cashAmount) || 0);
                          const a2 = uiPaymentMethod === 'SPLIT_MPESA_CASH'
                            ? (Number.parseFloat(cashAmount) || 0)
                            : (Number.parseFloat(cardAmount) || 0);
                          return a1 <= 0 || a2 <= 0 || Math.abs(a1 + a2 - total) > 1;
                        })()) ||
                      (uiPaymentMethod === 'HOUSE_ACCOUNT' && !selectedHouseAccountId) ||
                      (uiPaymentMethod === 'CORPORATE_ACCOUNT' && !selectedCorporateAccountId) ||
                      (uiPaymentMethod === 'CUSTOMER_CREDIT' && !selectedCustomerCreditId)
                    }
                    onClick={() => {
                      if (selectedDiscountId === 'staff' && !order.discountAmount) {
                        // Staff discount path — submit discount request; actual payment follows approval
                        onPayment(order.id, { paymentMethod: uiPaymentMethod as PaymentMethod, applyStaffDiscount: true });
                        return;
                      }
                      if (selectedDiscountId !== null && selectedDiscountId !== 'staff' && !order.discountAmount) {
                        // Customer discount path
                        onPayment(order.id, {
                          paymentMethod: uiPaymentMethod as PaymentMethod,
                          applyDiscountId: selectedDiscountId,
                        });
                        return;
                      }
                      if (uiPaymentMethod === 'SPLIT_MPESA_CASH') {
                        onPayment(order.id, {
                          paymentMethod: 'SPLIT',
                          splitType: 'MPESA_CASH',
                          mpesaCode: mpesaCode.trim(),
                          mpesaAmount: Number.parseFloat(mpesaAmount),
                          cashAmount: Number.parseFloat(cashAmount),
                        });
                      } else if (uiPaymentMethod === 'SPLIT_MPESA_CARD') {
                        onPayment(order.id, {
                          paymentMethod: 'SPLIT',
                          splitType: 'MPESA_CARD',
                          mpesaCode: mpesaCode.trim(),
                          mpesaAmount: Number.parseFloat(mpesaAmount),
                          cardAmount: Number.parseFloat(cardAmount),
                        });
                      } else if (uiPaymentMethod === 'SPLIT_CASH_CARD') {
                        onPayment(order.id, {
                          paymentMethod: 'SPLIT',
                          splitType: 'CASH_CARD',
                          cashAmount: Number.parseFloat(cashAmount),
                          cardAmount: Number.parseFloat(cardAmount),
                        });
                      } else if (uiPaymentMethod === 'HOUSE_ACCOUNT') {
                        onPayment(order.id, { paymentMethod: 'HOUSE_ACCOUNT', houseAccountId: selectedHouseAccountId });
                      } else if (uiPaymentMethod === 'CORPORATE_ACCOUNT') {
                        onPayment(order.id, {
                          paymentMethod: 'CORPORATE_ACCOUNT',
                          corporateAccountId: selectedCorporateAccountId,
                          corporateEmployeeRef: corporateEmployeeRef.trim() || undefined,
                        });
                      } else if (uiPaymentMethod === 'CUSTOMER_CREDIT') {
                        onPayment(order.id, { paymentMethod: 'CUSTOMER_CREDIT', customerCreditAccountId: selectedCustomerCreditId });
                      } else {
                        onPayment(order.id, {
                          paymentMethod: uiPaymentMethod as PaymentMethod,
                          mpesaCode: uiPaymentMethod === 'MPESA' ? mpesaCode.trim() : undefined,
                        });
                      }
                    }}
                  >
                    {selectedDiscountId !== null && !order.discountAmount
                      ? (() => {
                          if (selectedDiscountId === 'staff') return 'Request Discount & Await Approval';
                          const d = availableDiscounts.find((x) => x.id === selectedDiscountId);
                          return d?.requiresApproval
                            ? 'Request Discount & Await Approval'
                            : 'Apply Discount & Confirm Payment';
                        })()
                      : 'Confirm Payment'}
                  </Button>
                </>
              )}
              {isPaymentSubmitting && (
                <p className="text-center text-caption text-stone-500">
                  Please wait while we close the order.
                </p>
              )}
            </div>
          )}

          {/* Staff discount pending — identified by pendingStaffDiscountRequestId */}
          {order.status === 'AWAITING_AUTHORIZATION' && pendingStaffDiscountRequestId && (() => (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-amber-600 shrink-0" />
                <p className="text-label-sm font-semibold text-amber-800">Awaiting Discount Approval</p>
              </div>
              <p className="text-body-sm text-amber-700">
                A 30% staff discount has been requested. A manager must approve before payment can be collected.
              </p>
              {isManager && onStaffDiscountOverride && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    isLoading={isStaffDiscountOverrideSubmitting}
                    onClick={() => onStaffDiscountOverride(order.id, 'APPROVED')}
                  >
                    Approve Discount
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    isLoading={isStaffDiscountOverrideSubmitting}
                    onClick={() => onStaffDiscountOverride(order.id, 'REJECTED')}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))()}

          {/* Customer discount pending */}
          {order.status === 'AWAITING_AUTHORIZATION' && pendingCustomerDiscountRequestId && (() => (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-amber-600 shrink-0" />
                <p className="text-label-sm font-semibold text-amber-800">Awaiting Discount Approval</p>
              </div>
              <p className="text-body-sm text-amber-700">
                A{pendingCustomerDiscountName ? ` "${pendingCustomerDiscountName}"` : ''} discount has been requested. A manager must approve before payment can be collected.
              </p>
              {isManager && onCustomerDiscountOverride && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    isLoading={isCustomerDiscountOverrideSubmitting}
                    onClick={() => onCustomerDiscountOverride(order.id, 'APPROVED')}
                  >
                    Approve Discount
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    isLoading={isCustomerDiscountOverrideSubmitting}
                    onClick={() => onCustomerDiscountOverride(order.id, 'REJECTED')}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </div>
          ))()}

          {/* House account pending — identified by absence of staff or customer discount request */}
          {order.status === 'AWAITING_AUTHORIZATION' && !pendingStaffDiscountRequestId && !pendingCustomerDiscountRequestId && (() => {
            const isExpired = pendingAuthExpiresAt ? new Date(pendingAuthExpiresAt) < new Date() : false;
            return (
              <div className={`rounded-md border p-4 space-y-3 ${isExpired ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-center gap-2">
                  <Clock size={16} className={isExpired ? 'text-red-600 shrink-0' : 'text-amber-600 shrink-0'} />
                  <p className={`text-label-sm font-semibold ${isExpired ? 'text-red-800' : 'text-amber-800'}`}>
                    {isExpired ? 'Authorization Expired' : 'Awaiting Authorization'}
                  </p>
                </div>
                {isExpired ? (
                  <p className="text-body-sm text-red-700">
                    The charge request to <span className="font-medium">{pendingAuthHolderName ?? 'the account holder'}</span> has expired.
                    A manager must return this order to Ready so the waiter can collect payment another way.
                  </p>
                ) : (
                  <p className="text-body-sm text-amber-700">
                    A charge request has been sent to{' '}
                    <span className="font-medium">{pendingAuthHolderName ?? 'the account holder'}</span>.
                    {' '}The order will close automatically once approved.
                  </p>
                )}
                {isManager && pendingAuthRequestId && (
                  isExpired ? (
                    onAuthForceExpire && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        isLoading={isAuthOverrideSubmitting}
                        onClick={() => onAuthForceExpire(order.id)}
                      >
                        Return Order to Ready
                      </Button>
                    )
                  ) : (
                    onAuthOverride && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1"
                          isLoading={isAuthOverrideSubmitting}
                          onClick={() => onAuthOverride(order.id, 'APPROVED')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          isLoading={isAuthOverrideSubmitting}
                          onClick={() => onAuthOverride(order.id, 'REJECTED')}
                        >
                          Reject
                        </Button>
                      </div>
                    )
                  )
                )}
              </div>
            );
          })()}

          {isPaid && onPrintReceipt && (
            <Button
              variant="secondary"
              className="w-full"
              isLoading={isPrintSubmitting}
              onClick={handleReprintClick}
            >
              <Printer size={16} className="mr-2 shrink-0" />
              Print Receipt
            </Button>
          )}
        </div>
      </BottomSheet>

      {/* Reprint confirmation â€” prevents accidental duplicate prints */}
      <BottomSheet
        isOpen={isReprintConfirmOpen}
        onClose={() => setIsReprintConfirmOpen(false)}
        title="Print Receipt?"
      >
        <div className="space-y-4">
          <p className="text-body-md text-stone-700">
            This will print 2 copies (customer + accountant). If you already printed this receipt, it will print again.
          </p>
          <Button className="w-full" onClick={handleReprintConfirm}>
            Yes, Print
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => setIsReprintConfirmOpen(false)}>
            Cancel
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
