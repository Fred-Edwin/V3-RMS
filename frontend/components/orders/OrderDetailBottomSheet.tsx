'use client';

import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { BottomSheet, Button, PriceDisplay, Select } from '@/components/ui';
import type { OrderDetail, PaymentMethod } from '@/types/order';

interface OrderDetailBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetail | null;
  onEdit: (orderId: string) => void;
  onPayment: (orderId: string, method: PaymentMethod) => void;
  onCancel?: (orderId: string) => void;
  onPrintBill?: (orderId: string) => void;
  onPrintReceipt?: (orderId: string) => void;
  isPaymentSubmitting?: boolean;
  isPrintBillSubmitting?: boolean;
  isPrintSubmitting?: boolean;
  isOwner?: boolean;
  isManager?: boolean;
}

const paymentOptions = [
  { value: 'MPESA', label: 'Mpesa' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
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
}: OrderDetailBottomSheetProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MPESA');
  const [isReprintConfirmOpen, setIsReprintConfirmOpen] = useState(false);

  const allPending = useMemo(
    () => Boolean(order?.prepTickets.every((ticket) => ticket.status === 'PENDING')),
    [order],
  );
  const canEdit = isOwner && allPending;
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
          <div className="rounded-md border border-stone-200 p-3">
            <p className="text-body-sm text-stone-500">{order.type.replace('_', ' ')}</p>
            {order.tableNumber && <p className="text-body-md text-stone-900">Table {order.tableNumber}</p>}
            {order.notes && <p className="mt-1 text-body-sm text-stone-700">{order.notes}</p>}
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

          <div className="rounded-md border border-stone-200 p-3">
            <p className="mb-2 text-body-md font-semibold text-stone-900">Preparation Status</p>
            <div className="space-y-2">
              {order.prepTickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between">
                  <span className="text-body-sm text-stone-700">{ticket.station}</span>
                  <span className="text-body-sm text-stone-700">
                    {ticket.status}
                    {ticket.claimedBy ? ` - ${ticket.claimedBy.name}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-stone-200 pt-3">
            <span className="text-body-md font-semibold text-stone-900">Total</span>
            <PriceDisplay amount={Number.parseFloat(order.total)} />
          </div>

          {canEdit && (
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
                  onClick={() => onPayment(order.id, 'MPESA')}
                >
                  Hand to Grubba
                </Button>
              ) : (
                <>
                  <Select
                    label="Payment method"
                    options={paymentOptions}
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  />
                  <Button
                    className="w-full"
                    isLoading={isPaymentSubmitting}
                    onClick={() => onPayment(order.id, paymentMethod)}
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

      {/* Reprint confirmation — prevents accidental duplicate prints */}
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
