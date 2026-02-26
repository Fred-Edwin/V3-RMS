'use client';

import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { BottomSheet, Button, IconButton, Input, PriceDisplay, Select, Textarea } from '@/components/ui';
import { selectCartCount, selectCartTotal, useOrderStore } from '@/store/orderStore';
import type { DeliveryZone } from '@/services/deliveryZoneService';
import type { OrderType } from '@/types/order';

interface CheckoutSheetProps {
  isOpen: boolean;
  isSubmitting: boolean;
  orderType: OrderType;
  tableNumber: string;
  selectedZoneId: string;
  notes: string;
  zones: DeliveryZone[];
  onClose: () => void;
  onOrderTypeChange: (next: OrderType) => void;
  onTableNumberChange: (value: string) => void;
  onSelectedZoneChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
}

export function CheckoutSheet({
  isOpen,
  isSubmitting,
  orderType,
  tableNumber,
  selectedZoneId,
  notes,
  zones,
  onClose,
  onOrderTypeChange,
  onTableNumberChange,
  onSelectedZoneChange,
  onNotesChange,
  onSubmit,
}: CheckoutSheetProps): JSX.Element {
  const cart = useOrderStore((state) => state.cart);
  const updateCartQuantity = useOrderStore((state) => state.updateCartQuantity);
  const removeFromCart = useOrderStore((state) => state.removeFromCart);
  const cartItemCount = selectCartCount(cart);
  const subtotal = selectCartTotal(cart);
  const selectedZone = useMemo(
    () => zones.find((zone) => zone.id === selectedZoneId) ?? null,
    [selectedZoneId, zones],
  );
  const deliveryFee = orderType === 'DELIVERY' && selectedZone ? Number.parseFloat(selectedZone.fee) : 0;
  const total = subtotal + deliveryFee;
  const [isDeliveryPaymentConfirmed, setIsDeliveryPaymentConfirmed] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setIsDeliveryPaymentConfirmed(false);
  }, [isOpen]);

  useEffect(() => {
    if (orderType !== 'DELIVERY' && isDeliveryPaymentConfirmed) {
      setIsDeliveryPaymentConfirmed(false);
    }
  }, [isDeliveryPaymentConfirmed, orderType]);

  const canSubmit =
    cart.length > 0 &&
    (orderType !== 'DINE_IN' || tableNumber.trim().length > 0) &&
    (orderType !== 'DELIVERY' || selectedZoneId.length > 0) &&
    (orderType !== 'DELIVERY' || isDeliveryPaymentConfirmed);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
      title="Checkout"
    >
      <div className="space-y-4">
        <div className="rounded-md border border-stone-200 bg-white p-3">
          <p className="text-label-sm text-stone-500">Order Type</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Button
              size="sm"
              variant={orderType === 'DINE_IN' ? 'primary' : 'secondary'}
              onClick={() => onOrderTypeChange('DINE_IN')}
            >
              Dine-In
            </Button>
            <Button
              size="sm"
              variant={orderType === 'TAKE_AWAY' ? 'primary' : 'secondary'}
              onClick={() => onOrderTypeChange('TAKE_AWAY')}
            >
              Takeaway
            </Button>
            <Button
              size="sm"
              variant={orderType === 'DELIVERY' ? 'primary' : 'secondary'}
              onClick={() => onOrderTypeChange('DELIVERY')}
            >
              Delivery
            </Button>
          </div>
        </div>

        {orderType === 'DINE_IN' && (
          <Input
            label="Table Number"
            value={tableNumber}
            onChange={(event) => onTableNumberChange(event.target.value)}
            placeholder="e.g. 4"
          />
        )}

        {orderType === 'DELIVERY' && (
          <div className="space-y-3 rounded-md border border-stone-200 bg-white p-3">
            <Select
              label="Delivery Zone"
              value={selectedZoneId}
              onChange={(event) => onSelectedZoneChange(event.target.value)}
              placeholder="Select delivery zone"
              options={zones.map((zone) => ({
                value: zone.id,
                label: `${zone.name} - KES ${Number.parseFloat(zone.fee).toFixed(2)}`,
              }))}
            />

            <label className="flex items-start gap-2 rounded-md border border-amber/40 bg-[#FDF3DC] p-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[#92650A]"
                checked={isDeliveryPaymentConfirmed}
                onChange={(event) => setIsDeliveryPaymentConfirmed(event.target.checked)}
                disabled={isSubmitting}
              />
              <span className="text-body-sm text-[#92650A]">
                Confirm customer has paid KES {total.toFixed(2)} (Mpesa) before submitting.
              </span>
            </label>
          </div>
        )}

        <Textarea
          label="Order Notes"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Optional instructions..."
        />

        <div className="space-y-3 rounded-md border border-stone-200 bg-white p-3">
          <p className="text-label-sm text-stone-500">Items ({cartItemCount})</p>
          {cart.length === 0 ? (
            <p className="text-body-sm text-stone-500">Your cart is empty.</p>
          ) : (
            cart.map((item) => (
              <div key={item.menuItemId} className="rounded-md border border-stone-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-body-md font-semibold text-stone-900">{item.name}</p>
                    <p className="text-caption text-stone-500">KES {item.price.toFixed(2)} each</p>
                  </div>
                  <IconButton
                    icon={<Trash2 size={16} />}
                    label="Remove item"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFromCart(item.menuItemId)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IconButton
                      icon={<Minus size={14} />}
                      label="Decrease quantity"
                      variant="secondary"
                      size="sm"
                      onClick={() => updateCartQuantity(item.menuItemId, item.quantity - 1)}
                      disabled={isSubmitting}
                    />
                    <span className="min-w-6 text-center text-body-sm text-stone-900">{item.quantity}</span>
                    <IconButton
                      icon={<Plus size={14} />}
                      label="Increase quantity"
                      variant="secondary"
                      size="sm"
                      onClick={() => updateCartQuantity(item.menuItemId, item.quantity + 1)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <PriceDisplay amount={item.quantity * item.price} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sticky bottom-0 mt-4 space-y-3 border-t border-stone-200 bg-white px-1 py-3">
        <div className="rounded-md border border-stone-200 px-3 py-2">
          <div className="flex items-center justify-between text-body-sm text-stone-600">
            <span>Items</span>
            <span>{cartItemCount}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-body-sm text-stone-600">
            <span>Subtotal</span>
            <PriceDisplay amount={subtotal} />
          </div>
          {orderType === 'DELIVERY' && (
            <div className="mt-1 flex items-center justify-between text-body-sm text-stone-600">
              <span>Delivery Fee</span>
              <PriceDisplay amount={deliveryFee} />
            </div>
          )}
          <div className="mt-2 flex items-center justify-between border-t border-stone-200 pt-2">
            <span className="text-body-md font-semibold text-stone-900">Total</span>
            <PriceDisplay amount={total} />
          </div>
        </div>

        <Button className="w-full" isLoading={isSubmitting} disabled={!canSubmit} onClick={onSubmit}>
          Place Order
        </Button>
      </div>
    </BottomSheet>
  );
}
