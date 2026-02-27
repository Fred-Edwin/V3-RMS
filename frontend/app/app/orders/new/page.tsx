'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { CheckoutSheet } from '@/components/orders/CheckoutSheet';
import { OrderMenuItemTile } from '@/components/orders/OrderMenuItemTile';
import { Button, PageHeader, PageLayout } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { menuService } from '@/services/menuService';
import { deliveryZoneService, type DeliveryZone } from '@/services/deliveryZoneService';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/store/authStore';
import { selectCartCount, selectCartTotal, useOrderStore } from '@/store/orderStore';
import type { CreateOrderDto, OrderType } from '@/types/order';
import type { MenuCategoryWithAvailability } from '@/types/menu';
import { ApiError } from '@/types/api';

const formatCurrency = (amount: number): string => {
  return `KES ${amount.toFixed(2)}`;
};

export default function NewOrderPage(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearCart = useOrderStore((state) => state.clearCart);
  const cartItemCount = useOrderStore((state) => selectCartCount(state.cart));
  const cartSubtotal = useOrderStore((state) => selectCartTotal(state.cart));

  const [categories, setCategories] = useState<MenuCategoryWithAvailability[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [tableNumber, setTableNumber] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    menuService
      .getMenu(accessToken)
      .then((menu) => {
        setCategories(menu.categories);
        setSelectedCategoryId(menu.categories[0]?.id ?? null);
      })
      .catch((error) => {
        const message = error instanceof ApiError ? error.message : 'Try again later';
        toast({
          variant: 'error',
          title: 'Failed to load menu',
          message,
        });
      });
  }, [accessToken, toast]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    deliveryZoneService
      .listZones(accessToken)
      .then((response) => {
        setZones(response);
      })
      .catch((error) => {
        const message = error instanceof ApiError ? error.message : 'Try again later';
        toast({
          variant: 'error',
          title: 'Failed to load delivery zones',
          message,
        });
      });
  }, [accessToken, toast]);

  useEffect(() => {
    if (orderType !== 'DELIVERY' && selectedZoneId) {
      setSelectedZoneId('');
    }
  }, [orderType, selectedZoneId]);

  useEffect(() => {
    if (!isCheckoutOpen || typeof performance === 'undefined') {
      return;
    }

    requestAnimationFrame(() => {
      performance.mark('waiter:checkout-open:end');
      performance.measure('waiter:checkout-open', 'waiter:checkout-open:start', 'waiter:checkout-open:end');
    });
  }, [isCheckoutOpen]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? categories[0],
    [categories, selectedCategoryId],
  );

  const handleOpenCheckout = useCallback(() => {
    if (cartItemCount === 0) {
      return;
    }

    if (typeof performance !== 'undefined') {
      performance.mark('waiter:checkout-open:start');
    }

    setIsCheckoutOpen(true);
  }, [cartItemCount]);

  const handleSubmit = useCallback(async () => {
    if (!accessToken || isSubmitting) {
      return;
    }

    const cart = useOrderStore.getState().cart;
    if (cart.length === 0) {
      return;
    }

    const sharedItems = cart.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      notes: item.notes,
    }));

    const dto: CreateOrderDto =
      orderType === 'DINE_IN'
        ? {
            type: 'DINE_IN',
            tableNumber: tableNumber.trim(),
            notes: notes.trim() || undefined,
            items: sharedItems,
          }
        : orderType === 'DELIVERY'
          ? {
              type: 'DELIVERY',
              deliveryZoneId: selectedZoneId,
              notes: notes.trim() || undefined,
              items: sharedItems,
            }
          : {
              type: 'TAKE_AWAY',
              notes: notes.trim() || undefined,
              items: sharedItems,
            };

    if (typeof performance !== 'undefined') {
      performance.mark('waiter:submit-order:start');
    }

    setIsSubmitting(true);
    try {
      const createdOrder = await orderService.create(dto, accessToken);

      if (typeof performance !== 'undefined') {
        performance.mark('waiter:submit-order:end');
        performance.measure('waiter:submit-order', 'waiter:submit-order:start', 'waiter:submit-order:end');
      }

      toast({
        variant: 'success',
        title: `Order #${createdOrder.dailyNumber} sent to the kitchen`,
      });

      clearCart();
      setIsCheckoutOpen(false);
      setTableNumber('');
      setSelectedZoneId('');
      setNotes('');
      router.push('/app/orders');
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to create order',
        message: error instanceof Error ? error.message : 'Try again',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    accessToken,
    clearCart,
    isSubmitting,
    notes,
    orderType,
    router,
    selectedZoneId,
    tableNumber,
    toast,
  ]);

  return (
    <PageLayout className="space-y-4 pb-28">
      <PageHeader title="New Order" subtitle="Add items and place quickly" />

      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategoryId === category.id ? 'primary' : 'secondary'}
            size="sm"
            className="shrink-0 whitespace-nowrap"
            onClick={() => setSelectedCategoryId(category.id)}
          >
            {category.name}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {selectedCategory?.items.map((item) => (
          <OrderMenuItemTile key={item.id} item={item} />
        ))}
      </div>

      <button
        type="button"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 rounded-full border border-espresso bg-crema px-4 py-3 shadow-md transition-shadow duration-fast hover:shadow-lg focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-60"
        onClick={handleOpenCheckout}
        disabled={cartItemCount === 0}
      >
        <span className="flex items-center gap-2">
          <ShoppingCart size={18} className="text-espresso" />
          <span className="text-label-md text-espresso">Cart</span>
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-espresso px-1.5 py-0.5 text-caption text-crema">
            {cartItemCount}
          </span>
        </span>
        <span className="mt-1 block text-caption text-stone-600">{formatCurrency(cartSubtotal)}</span>
      </button>

      <CheckoutSheet
        isOpen={isCheckoutOpen}
        isSubmitting={isSubmitting}
        orderType={orderType}
        tableNumber={tableNumber}
        selectedZoneId={selectedZoneId}
        notes={notes}
        zones={zones}
        onClose={() => setIsCheckoutOpen(false)}
        onOrderTypeChange={setOrderType}
        onTableNumberChange={setTableNumber}
        onSelectedZoneChange={setSelectedZoneId}
        onNotesChange={setNotes}
        onSubmit={() => void handleSubmit()}
      />
    </PageLayout>
  );
}
