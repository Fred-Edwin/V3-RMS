'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ShoppingCart } from 'lucide-react';
import { CheckoutSheet } from '@/components/orders/CheckoutSheet';
import { OrderMenuItemTile } from '@/components/orders/OrderMenuItemTile';
import { Button, EmptyState, Input, PageHeader, PageLayout } from '@/components/ui';
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
  const [searchTerm, setSearchTerm] = useState('');

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

  const normalizedSearchTerm = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);
  const hasSearch = normalizedSearchTerm.length > 0;

  const filteredCategories = useMemo(() => {
    if (!hasSearch) {
      return [];
    }

    return categories.flatMap((category) => {
      const visibleItems = category.items.filter((item) => {
        return (
          item.name.toLowerCase().includes(normalizedSearchTerm) ||
          (item.description?.toLowerCase().includes(normalizedSearchTerm) ?? false)
        );
      });

      if (visibleItems.length === 0) {
        return [];
      }

      return [{ ...category, items: visibleItems }];
    });
  }, [categories, hasSearch, normalizedSearchTerm]);

  const searchResultCount = useMemo(() => {
    if (!hasSearch) {
      return 0;
    }

    return filteredCategories.reduce((total, category) => total + category.items.length, 0);
  }, [filteredCategories, hasSearch]);

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

      <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              id="waiter-menu-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search menu items"
              leftIcon={<Search size={16} />}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-10"
            onClick={() => setSearchTerm('')}
            disabled={!hasSearch}
          >
            Clear
          </Button>
        </div>
        {hasSearch ? (
          <p className="mt-2 text-caption text-stone-500">
            {searchResultCount === 0
              ? 'No items match your search yet.'
              : `Found ${searchResultCount} item${searchResultCount === 1 ? '' : 's'} across ${
                  filteredCategories.length
                } categor${filteredCategories.length === 1 ? 'y' : 'ies'}.`}
          </p>
        ) : null}
      </section>

      {!hasSearch && (
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
      )}

      {hasSearch && filteredCategories.length === 0 && (
        <EmptyState
          icon={<Search size={28} />}
          heading="No menu items found"
          body="Try searching by item name or a key ingredient."
        />
      )}

      {hasSearch ? (
        <div className="space-y-6">
          {filteredCategories.map((category) => (
            <section key={category.id} className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-heading-md font-semibold text-stone-900">{category.name}</h2>
                <span className="text-caption text-stone-400">{category.items.length} items</span>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {category.items.map((item) => (
                  <OrderMenuItemTile key={item.id} item={item} prepStation={category.prepStation} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {selectedCategory?.items.map((item) => (
            <OrderMenuItemTile key={item.id} item={item} prepStation={selectedCategory.prepStation} />
          ))}
        </div>
      )}

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
