'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CartBottomSheet } from '@/components/orders/CartBottomSheet';
import { Button, IconButton, MenuItemCard, PageHeader, PageLayout } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { menuService } from '@/services/menuService';
import { modificationRequestService } from '@/services/modificationRequestService';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/store/authStore';
import { useOrderStore } from '@/store/orderStore';
import { ShoppingCart } from 'lucide-react';
import type { MenuCategoryWithAvailability } from '@/types/menu';
import type { OrderDetail } from '@/types/order';

export default function EditOrderPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);

  const cart = useOrderStore((state) => state.cart);
  const setCart = useOrderStore((state) => state.setCart);
  const addToCart = useOrderStore((state) => state.addToCart);
  const clearCart = useOrderStore((state) => state.clearCart);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [categories, setCategories] = useState<MenuCategoryWithAvailability[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasApprovedModRequest, setHasApprovedModRequest] = useState(false);

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

        // Check if there's an approved modification request allowing edit
        const hasNonPending = loadedOrder.prepTickets.some((t) => t.status !== 'PENDING');
        if (hasNonPending) {
          modificationRequestService
            .getByOrder(loadedOrder.id, accessToken)
            .then((requests) => {
              const approved = requests.some((r) => r.status === 'APPROVED');
              setHasApprovedModRequest(approved);
            })
            .catch(() => {
              // Silently fail — locked state is the safe default
            });
        }
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

  const allTicketsPending = useMemo(
    () => Boolean(order && order.prepTickets.every((ticket) => ticket.status === 'PENDING')),
    [order],
  );

  const isLocked = useMemo(
    () => Boolean(order && !allTicketsPending && !hasApprovedModRequest),
    [order, allTicketsPending, hasApprovedModRequest],
  );

  const handleSave = async () => {
    if (!accessToken || !order) {
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
    <PageLayout className="space-y-4">
      <PageHeader
        title={order ? `Edit Order #${order.dailyNumber}` : 'Edit Order'}
        subtitle={hasApprovedModRequest && !allTicketsPending ? 'Modification approved — edit and save' : 'Modify items while stations are still pending'}
        action={
          <div className="relative">
            <IconButton
              icon={<ShoppingCart size={20} />}
              label="Open cart"
              variant="secondary"
              onClick={() => setIsCartOpen(true)}
            />
            {cart.length > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-amber px-1 text-caption text-stone-900">
                {cart.length}
              </span>
            )}
          </div>
        }
      />

      {isLocked && (
        <div className="rounded-md border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-body-sm text-[#991B1B]">
          This order is being prepared. Submit a modification request from the order details to request changes.
        </div>
      )}

      {hasApprovedModRequest && !allTicketsPending && (
        <div className="rounded-md border border-amber/50 bg-amber/10 p-3 text-body-sm text-stone-800">
          Modification approved — make your changes and save.
        </div>
      )}

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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {selectedCategory?.items.map((item) => (
          <MenuItemCard
            key={item.id}
            name={item.name}
            description={item.description ?? undefined}
            price={Number.parseFloat(item.price)}
            isAvailable={item.isAvailable}
            onAdd={() =>
              addToCart({
                menuItemId: item.id,
                name: item.name,
                price: Number.parseFloat(item.price),
                quantity: 1,
                notes: null,
              })
            }
          />
        ))}
      </div>

      <Button className="w-full" isLoading={isSubmitting} disabled={isLocked || cart.length === 0} onClick={() => void handleSave()}>
        Save Changes
      </Button>

      <CartBottomSheet isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} onSubmit={() => setIsCartOpen(false)} />
    </PageLayout>
  );
}
