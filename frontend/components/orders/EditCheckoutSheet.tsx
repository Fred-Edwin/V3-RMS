'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import { BottomSheet, Button, IconButton, PriceDisplay } from '@/components/ui';
import { selectCartCount, selectCartTotal, useOrderStore } from '@/store/orderStore';
import type { PrepStation } from '@/types/order';

interface EditCheckoutSheetProps {
  isOpen: boolean;
  isSubmitting: boolean;
  lockedStations?: PrepStation[];
  onClose: () => void;
  onSubmit: () => void;
}

export function EditCheckoutSheet({
  isOpen,
  isSubmitting,
  lockedStations = [],
  onClose,
  onSubmit,
}: EditCheckoutSheetProps): JSX.Element {
  const cart = useOrderStore((state) => state.cart);
  const updateCartQuantity = useOrderStore((state) => state.updateCartQuantity);
  const removeFromCart = useOrderStore((state) => state.removeFromCart);
  const cartItemCount = selectCartCount(cart);
  const subtotal = selectCartTotal(cart);
  const lockedStationSet = new Set(lockedStations);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Review Changes">
      <div className="space-y-4">
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
                    disabled={isSubmitting || lockedStationSet.has(item.prepStation)}
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
                      disabled={isSubmitting || lockedStationSet.has(item.prepStation)}
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
          <div className="mt-2 flex items-center justify-between border-t border-stone-200 pt-2">
            <span className="text-body-md font-semibold text-stone-900">Total</span>
            <PriceDisplay amount={subtotal} />
          </div>
        </div>

        <Button className="w-full" isLoading={isSubmitting} disabled={cart.length === 0} onClick={onSubmit}>
          Save Changes
        </Button>
      </div>
    </BottomSheet>
  );
}


