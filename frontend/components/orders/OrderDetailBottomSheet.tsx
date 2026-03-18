'use client';

import { useState } from 'react';
import { Printer, ChefHat, Coffee, User, Plus } from 'lucide-react';
import { BottomSheet, Button, Input, PriceDisplay, Select } from '@/components/ui';
import { env } from '@/lib/env';
import type { OrderDetail, PaymentMethod } from '@/types/order';
import type { HouseAccountDropdownItem } from '@/services/houseAccountService';
import type { CorporateAccountDropdownItem } from '@/services/corporateAccountService';
import type { CustomerCreditDropdownItem } from '@/services/customerCreditService';

export interface PaymentPayload {
  paymentMethod: PaymentMethod;
  mpesaCode?: string;
  mpesaAmount?: number;
  cashAmount?: number;
  houseAccountId?: string;
  corporateAccountId?: string;
  corporateEmployeeRef?: string;
  customerCreditAccountId?: string;
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
}

const BASE_PAYMENT_OPTIONS = [
  { value: 'MPESA', label: 'Mpesa' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'SPLIT', label: 'Split (Mpesa + Cash)' },
];

const CREDIT_PAYMENT_OPTIONS = [
  { value: 'HOUSE_ACCOUNT', label: 'House Account' },
  { value: 'CORPORATE_ACCOUNT', label: 'Corporate Account' },
  { value: 'CUSTOMER_CREDIT', label: 'Customer Credit' },
];

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
}: OrderDetailBottomSheetProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MPESA');
  const [mpesaCode, setMpesaCode] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [isReprintConfirmOpen, setIsReprintConfirmOpen] = useState(false);

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

  const canEdit = isOwner && order?.status !== 'CLOSED' && order?.status !== 'CANCELLED';
  const isPaid = Boolean(order?.paymentMethod);
  const canCancel =
    (isOwner && order?.status !== 'CLOSED' && order?.status !== 'CANCELLED') ||
    (isManager && order?.status !== 'CLOSED' && order?.status !== 'CANCELLED');

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
            <div className="rounded-md border border-stone-200 p-3">
              <p className="mb-2.5 text-body-sm font-semibold text-stone-500 uppercase tracking-wide">Preparation</p>
              <div className="space-y-2">
                {order.prepTickets.map((ticket) => {
                  const isRejected = ticket.status === 'REJECTED';
                  const isReady = ticket.status === 'READY';
                  const isInProgress = ticket.status === 'IN_PROGRESS';
                  const StationIcon = ticket.station === 'KITCHEN' ? ChefHat : Coffee;

                  return (
                    <div
                      key={ticket.id}
                      className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 ${
                        isRejected
                          ? 'bg-red-50 border border-red-100'
                          : isReady
                            ? 'bg-green-50 border border-green-100'
                            : isInProgress
                              ? 'bg-amber-50 border border-amber-100'
                              : 'bg-stone-50 border border-stone-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <StationIcon
                          size={14}
                          className={`shrink-0 ${isRejected ? 'text-red-500' : isReady ? 'text-green-600' : isInProgress ? 'text-amber-600' : 'text-stone-400'}`}
                        />
                        <span className="text-label-sm font-medium text-stone-700">
                          {ticket.station === 'KITCHEN' ? 'Kitchen' : 'Barista'}
                        </span>
                      </div>

                      <div className="flex flex-col items-end gap-0.5 min-w-0">
                        <span
                          className={`text-label-sm font-semibold ${
                            isRejected ? 'text-red-600' : isReady ? 'text-green-700' : isInProgress ? 'text-amber-700' : 'text-stone-500'
                          }`}
                        >
                          {ticket.status === 'IN_PROGRESS' ? 'In Progress' : ticket.status.replace('_', ' ').charAt(0) + ticket.status.slice(1).toLowerCase().replace('_', ' ')}
                        </span>
                        {ticket.claimedBy && (
                          <span className="text-caption text-stone-500 truncate max-w-[120px]">
                            {ticket.claimedBy.name}
                          </span>
                        )}
                        {isRejected && ticket.rejectedReason && (
                          <span className="text-caption text-red-500 truncate max-w-[150px]" title={ticket.rejectedReason}>
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
                <Button
                  className="w-full"
                  isLoading={isPaymentSubmitting}
                  onClick={() => onPayment(order.id, { paymentMethod: 'MPESA', mpesaCode: mpesaCode.trim() || undefined })}
                >
                  Hand to Grubba
                </Button>
              ) : (
                <>
                  <Select
                    label="Payment method"
                    options={env.creditAccounts ? [...BASE_PAYMENT_OPTIONS, ...CREDIT_PAYMENT_OPTIONS] : BASE_PAYMENT_OPTIONS}
                    value={paymentMethod}
                    onChange={(event) => {
                      setPaymentMethod(event.target.value as PaymentMethod);
                      setMpesaCode('');
                      setMpesaAmount('');
                      setCashAmount('');
                      setSelectedHouseAccountId('');
                      setSelectedCorporateAccountId('');
                      setCorporateEmployeeRef('');
                      setSelectedCustomerCreditId('');
                      setShowNewCustomerForm(false);
                    }}
                  />

                  {/* Mpesa transaction code — shown for MPESA and SPLIT */}
                  {(paymentMethod === 'MPESA' || paymentMethod === 'SPLIT') && (
                    <Input
                      label="Mpesa transaction code"
                      placeholder="e.g. QHG3KL9XPO"
                      value={mpesaCode}
                      onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                    />
                  )}

                  {/* Split payment amount inputs */}
                  {paymentMethod === 'SPLIT' && (
                    <div className="rounded-md border border-stone-200 p-3 space-y-3">
                      <p className="text-label-sm font-medium text-stone-700">
                        Split amounts must total{' '}
                        <span className="text-espresso font-semibold">
                          KES {Number.parseFloat(order.total).toFixed(2)}
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Mpesa amount (KES)"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={mpesaAmount}
                          onChange={(e) => {
                            setMpesaAmount(e.target.value);
                            // Auto-fill cash remainder
                            const total = Number.parseFloat(order.total);
                            const mpesa = Number.parseFloat(e.target.value) || 0;
                            const remainder = total - mpesa;
                            if (remainder >= 0) setCashAmount(remainder.toFixed(2));
                          }}
                        />
                        <Input
                          label="Cash amount (KES)"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={cashAmount}
                          onChange={(e) => setCashAmount(e.target.value)}
                        />
                      </div>
                      {(() => {
                        const total = Number.parseFloat(order.total);
                        const mpesa = Number.parseFloat(mpesaAmount) || 0;
                        const cash = Number.parseFloat(cashAmount) || 0;
                        const diff = Math.abs(mpesa + cash - total);
                        if ((mpesa > 0 || cash > 0) && diff > 1) {
                          return (
                            <p className="text-caption text-red-600">
                              Amounts total KES {(mpesa + cash).toFixed(2)} — must equal KES {total.toFixed(2)}
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}

                  {/* House Account selector */}
                  {paymentMethod === 'HOUSE_ACCOUNT' && (
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
                  {paymentMethod === 'CORPORATE_ACCOUNT' && (
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
                  {paymentMethod === 'CUSTOMER_CREDIT' && (
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

                  <Button
                    className="w-full"
                    isLoading={isPaymentSubmitting}
                    disabled={
                      (paymentMethod === 'SPLIT' &&
                        (() => {
                          const total = Number.parseFloat(order.total);
                          const mpesa = Number.parseFloat(mpesaAmount) || 0;
                          const cash = Number.parseFloat(cashAmount) || 0;
                          return mpesa <= 0 || cash <= 0 || Math.abs(mpesa + cash - total) > 1;
                        })()) ||
                      (paymentMethod === 'HOUSE_ACCOUNT' && !selectedHouseAccountId) ||
                      (paymentMethod === 'CORPORATE_ACCOUNT' && !selectedCorporateAccountId) ||
                      (paymentMethod === 'CUSTOMER_CREDIT' && !selectedCustomerCreditId)
                    }
                    onClick={() => {
                      if (paymentMethod === 'SPLIT') {
                        onPayment(order.id, {
                          paymentMethod: 'SPLIT',
                          mpesaCode: mpesaCode.trim() || undefined,
                          mpesaAmount: Number.parseFloat(mpesaAmount),
                          cashAmount: Number.parseFloat(cashAmount),
                        });
                      } else if (paymentMethod === 'HOUSE_ACCOUNT') {
                        onPayment(order.id, { paymentMethod: 'HOUSE_ACCOUNT', houseAccountId: selectedHouseAccountId });
                      } else if (paymentMethod === 'CORPORATE_ACCOUNT') {
                        onPayment(order.id, {
                          paymentMethod: 'CORPORATE_ACCOUNT',
                          corporateAccountId: selectedCorporateAccountId,
                          corporateEmployeeRef: corporateEmployeeRef.trim() || undefined,
                        });
                      } else if (paymentMethod === 'CUSTOMER_CREDIT') {
                        onPayment(order.id, { paymentMethod: 'CUSTOMER_CREDIT', customerCreditAccountId: selectedCustomerCreditId });
                      } else {
                        onPayment(order.id, {
                          paymentMethod,
                          mpesaCode: paymentMethod === 'MPESA' ? (mpesaCode.trim() || undefined) : undefined,
                        });
                      }
                    }}
                  >
                    Confirm Payment
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
