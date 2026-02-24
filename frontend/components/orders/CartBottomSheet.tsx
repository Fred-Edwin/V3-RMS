'use client';

import { BottomSheet, Button, IconButton, PriceDisplay } from '@/components/ui';
import { useOrderStore, selectCartTotal } from '@/store/orderStore';
import { Minus, Plus, Trash2 } from 'lucide-react';

interface CartBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export function CartBottomSheet({ isOpen, onClose, onSubmit }: CartBottomSheetProps) {
  const cart = useOrderStore((state) => state.cart);
  const updateCartQuantity = useOrderStore((state) => state.updateCartQuantity);
  const removeFromCart = useOrderStore((state) => state.removeFromCart);

  const total = selectCartTotal(cart);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Cart">
      <div className="space-y-4">
        {cart.length === 0 ? (
          <p className="text-body-md text-stone-500">Your cart is empty.</p>
        ) : (
          cart.map((item) => (
            <div key={item.menuItemId} className="rounded-md border border-stone-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-body-md font-semibold text-stone-900">{item.name}</p>
                  <p className="text-body-sm text-stone-500">
                    {item.quantity} x KES {item.price.toFixed(2)}
                  </p>
                  <PriceDisplay amount={item.quantity * item.price} />
                </div>
                <IconButton
                  icon={<Trash2 size={16} />}
                  label="Remove item"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFromCart(item.menuItemId)}
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <IconButton
                  icon={<Minus size={16} />}
                  label="Decrease quantity"
                  variant="secondary"
                  size="sm"
                  onClick={() => updateCartQuantity(item.menuItemId, item.quantity - 1)}
                />
                <span className="min-w-8 text-center text-body-md text-stone-900">{item.quantity}</span>
                <IconButton
                  icon={<Plus size={16} />}
                  label="Increase quantity"
                  variant="secondary"
                  size="sm"
                  onClick={() => updateCartQuantity(item.menuItemId, item.quantity + 1)}
                />
              </div>
            </div>
          ))
        )}

        <div className="flex items-center justify-between border-t border-stone-200 pt-3">
          <span className="text-body-md font-semibold text-stone-900">Total</span>
          <PriceDisplay amount={total} />
        </div>

        <Button className="w-full" disabled={cart.length === 0} onClick={onSubmit}>
          Review Order
        </Button>
      </div>
    </BottomSheet>
  );
}
