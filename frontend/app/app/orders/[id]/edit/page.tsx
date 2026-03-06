'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { EditCheckoutSheet } from '@/components/orders/EditCheckoutSheet';
import { OrderMenuItemTile } from '@/components/orders/OrderMenuItemTile';
import { Button, PageHeader, PageLayout } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { menuService } from '@/services/menuService';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/store/authStore';
import { selectCartCount, selectCartTotal, useOrderStore } from '@/store/orderStore';
import type { MenuCategoryWithAvailability } from '@/types/menu';
import type { OrderDetail } from '@/types/order';

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

  useEffect(() => {
    if (!accessToken || !params.id) {
      return;
    }

    Promise.all([orderService.getById(params.id, accessToken), menuService.getMenu(accessToken)])
      .then(([loadedOrder, menu]) => {
        setOrder(loadedOrder);
        setCategories(menu.categories);
        setSelectedCategoryId(menu.categories[0]?.id ?? null);
        setCart(
          loadedOrder.items.map((item) => ({
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

      {/* Floating cart FAB — same pattern as new order page */}
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
