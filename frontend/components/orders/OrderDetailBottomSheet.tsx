'use client';

import { useMemo, useState } from 'react';
import { BottomSheet, Button, PriceDisplay, Select } from '@/components/ui';
import type { OrderDetail, PaymentMethod } from '@/types/order';

interface OrderDetailBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetail | null;
  onEdit: (orderId: string) => void;
  onPayment: (orderId: string, method: PaymentMethod) => void;
  isPaymentSubmitting?: boolean;
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
  isPaymentSubmitting = false,
}: OrderDetailBottomSheetProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('MPESA');

  const canEdit = useMemo(
    () => Boolean(order?.prepTickets.some((ticket) => ticket.status === 'PENDING')),
    [order],
  );

  if (!order) {
    return null;
  }

  return (
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
      </div>
    </BottomSheet>
  );
}
