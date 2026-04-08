'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Search, ShoppingCart } from 'lucide-react';
import { EditCheckoutSheet } from '@/components/orders/EditCheckoutSheet';
import { OrderMenuItemTile } from '@/components/orders/OrderMenuItemTile';
import { Button, EmptyState, Input, PageHeader, PageLayout } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { menuService } from '@/services/menuService';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/store/authStore';
import { selectCartCount, selectCartTotal, useOrderStore } from '@/store/orderStore';
import type { MenuCategoryWithAvailability } from '@/types/menu';
import type { OrderDetail, PrepStation } from '@/types/order';

const formatCurrency = (amount: number): string => {
  return `KES ${amount.toFixed(2)}`;
};

export default function EditOrderPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const setCart = useOrderStore((state) => state.setCart);
  const clearCart = useOrderStore((state) => state.clearCart);
  const cartItemCount = useOrderStore((state) => selectCartCount(state.cart));
  const cartSubtotal = useOrderStore((state) => selectCartTotal(state.cart));

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [categories, setCategories] = useState<MenuCategoryWithAvailability[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!accessToken || !params.id) {
      return;
    }

    Promise.all([orderService.getById(params.id, accessToken), menuService.getMenu(accessToken)])
      .then(([loadedOrder, menu]) => {
        setOrder(loadedOrder);
        setNotes(loadedOrder.notes ?? '');
        setCategories(menu.categories);
        setSelectedCategoryId(menu.categories[0]?.id ?? null);
        const prepStationByItemId = new Map<string, PrepStation>();
        menu.categories.forEach((category) => {
          category.items.forEach((item) => {
            prepStationByItemId.set(item.id, category.prepStation);
          });
        });

        setCart(
          loadedOrder.items.map((item) => ({
            lineId: crypto.randomUUID(),
            prepStation: prepStationByItemId.get(item.menuItemId) ?? 'KITCHEN',
            menuItemId: item.menuItemId,
            name: item.name,
            price: Number.parseFloat(item.unitPrice),
            quantity: item.quantity,
            notes: item.notes,
          })),
        );

      })
      .catch((error) => {
        toast({
          variant: 'error',
          title: 'Failed to load order',
          message: error instanceof Error ? error.message : 'Try again later',
        });
      });
  }, [accessToken, params.id, setCart, toast]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? categories[0],
    [categories, selectedCategoryId],
  );
  const lockedStations = useMemo(() => {
    if (!order) {
      return [];
    }

    const locked = new Set<PrepStation>();
    order.prepTickets.forEach((ticket) => {
      if (ticket.status === 'IN_PROGRESS' || ticket.status === 'READY') {
        locked.add(ticket.station);
      }
    });

    return Array.from(locked);
  }, [order]);

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

  const handleSave = async () => {
    if (!accessToken || !order) {
      return;
    }

    const cart = useOrderStore.getState().cart;
    if (cart.length === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await orderService.updateItems(
        order.id,
        {
          items: cart.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            notes: item.notes,
          })),
          notes,
        },
        accessToken,
      );
      toast({ variant: 'success', title: 'Order updated' });
      clearCart();
      setIsCheckoutOpen(false);
      router.push('/app/orders');
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to update order',
        message: error instanceof Error ? error.message : 'Try again later',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout className="space-y-4 pb-28">
      <PageHeader
        title={order ? `Edit Order #${order.dailyNumber}` : 'Edit Order'}
        subtitle="Modify items and save"
      />

      <section className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              id="waiter-edit-menu-search"
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

      {!hasSearch ? (
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
      ) : null}

      {hasSearch && filteredCategories.length === 0 ? (
        <EmptyState
          icon={<Search size={28} />}
          heading="No menu items found"
          body="Try searching by item name or a key ingredient."
        />
      ) : null}

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

      {/* Floating cart FAB â€” same pattern as new order page */}
      <button
        type="button"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 rounded-full border border-espresso bg-crema px-4 py-3 shadow-md transition-shadow duration-fast hover:shadow-lg focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => setIsCheckoutOpen(true)}
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

      <EditCheckoutSheet
        isOpen={isCheckoutOpen}
        isSubmitting={isSubmitting}
        lockedStations={lockedStations}
        notes={notes}
        onNotesChange={setNotes}
        onClose={() => {
          if (!isSubmitting) {
            setIsCheckoutOpen(false);
          }
        }}
        onSubmit={() => void handleSave()}
      />
    </PageLayout>
  );
}





