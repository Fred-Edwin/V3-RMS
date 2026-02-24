'use client';

import { BottomSheet, Button, PriceDisplay } from '@/components/ui';
import type { OrderType } from '@/types/order';
import type { CartItem } from '@/store/orderStore';
import { selectCartTotal } from '@/store/orderStore';

interface OrderConfirmBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  orderType: OrderType;
  tableNumber: string;
  notes: string;
  cart: CartItem[];
}

const typeLabels: Record<OrderType, string> = {
  DINE_IN: 'Dine-In',
  TAKE_AWAY: 'Take-Away',
  DELIVERY: 'Delivery',
};

export function OrderConfirmBottomSheet({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  orderType,
  tableNumber,
  notes,
  cart,
}: OrderConfirmBottomSheetProps) {
  const total = selectCartTotal(cart);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Confirm Order">
      <div className="space-y-4">
        <div className="rounded-md border border-stone-200 p-3">
          <p className="text-label-sm text-stone-500">Order Type</p>
          <p className="text-body-md font-semibold text-stone-900">{typeLabels[orderType]}</p>
          {orderType === 'DINE_IN' && (
            <>
              <p className="mt-2 text-label-sm text-stone-500">Table</p>
              <p className="text-body-md text-stone-900">{tableNumber}</p>
            </>
          )}
          {notes && (
            <>
              <p className="mt-2 text-label-sm text-stone-500">Notes</p>
              <p className="text-body-md text-stone-900">{notes}</p>
            </>
          )}
        </div>

        <div className="space-y-2">
          {cart.map((item) => (
            <div key={item.menuItemId} className="flex items-center justify-between">
              <span className="text-body-md text-stone-900">
                {item.quantity} x {item.name}
              </span>
              <PriceDisplay amount={item.quantity * item.price} />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-stone-200 pt-3">
          <span className="text-body-md font-semibold text-stone-900">Total</span>
          <PriceDisplay amount={total} />
        </div>

        <Button className="w-full" isLoading={isSubmitting} onClick={onConfirm}>
          Place Order
        </Button>
      </div>
    </BottomSheet>
  );
}
