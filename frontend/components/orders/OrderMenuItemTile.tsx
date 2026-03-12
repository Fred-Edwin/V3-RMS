'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { MenuItemCard } from '@/components/ui';
import { selectCartQuantityByItem, useOrderStore } from '@/store/orderStore';
import type { MenuItemWithAvailability } from '@/types/menu';
import type { PrepStation } from '@/types/order';

interface OrderMenuItemTileProps {
  item: MenuItemWithAvailability;
  prepStation: PrepStation;
}

function OrderMenuItemTileBase({ item, prepStation }: OrderMenuItemTileProps): JSX.Element {
  const addToCart = useOrderStore((state) => state.addToCart);
  const quantity = useOrderStore((state) => selectCartQuantityByItem(state.cart, item.id));
  const [isRecentlyAdded, setIsRecentlyAdded] = useState(false);
  const feedbackTimerRef = useRef<number | null>(null);
  const lastAddAtRef = useRef(0);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const handleAdd = () => {
    const now = Date.now();
    if (now - lastAddAtRef.current < 120) {
      return;
    }
    lastAddAtRef.current = now;

    if (typeof performance !== 'undefined') {
      performance.mark('waiter:add-to-cart:start');
    }

    addToCart({
      prepStation,
      menuItemId: item.id,
      name: item.name,
      price: Number.parseFloat(item.price),
      quantity: 1,
      notes: null,
    });

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    }

    setIsRecentlyAdded(true);
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setIsRecentlyAdded(false);
    }, 650);

    if (typeof performance !== 'undefined') {
      performance.mark('waiter:add-to-cart:end');
      performance.measure('waiter:add-to-cart', 'waiter:add-to-cart:start', 'waiter:add-to-cart:end');
    }
  };

  return (
    <MenuItemCard
      name={item.name}
      description={item.description ?? undefined}
      price={Number.parseFloat(item.price)}
      isAvailable={item.isAvailable}
      imageUrl={item.imageUrl ?? undefined}
      quantity={quantity}
      isRecentlyAdded={isRecentlyAdded}
      onAdd={handleAdd}
    />
  );
}

export const OrderMenuItemTile = memo(OrderMenuItemTileBase);

