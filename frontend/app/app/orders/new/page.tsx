'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import { CartBottomSheet } from '@/components/orders/CartBottomSheet';
import { OrderConfirmBottomSheet } from '@/components/orders/OrderConfirmBottomSheet';
import { Button, IconButton, Input, MenuItemCard, PageHeader, PageLayout, Textarea } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { menuService } from '@/services/menuService';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/store/authStore';
import { useOrderStore } from '@/store/orderStore';
import type { CreateOrderDto, OrderType } from '@/types/order';
import type { MenuCategoryWithAvailability } from '@/types/menu';

export default function NewOrderPage(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const accessToken = useAuthStore((state) => state.accessToken);
  const cart = useOrderStore((state) => state.cart);
  const addToCart = useOrderStore((state) => state.addToCart);
  const clearCart = useOrderStore((state) => state.clearCart);

  const [categories, setCategories] = useState<MenuCategoryWithAvailability[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [cartIconAnimation, setCartIconAnimation] = useState(false);

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
        toast({
          variant: 'error',
          title: 'Failed to load menu',
          message: error instanceof Error ? error.message : 'Try again later',
        });
      });
  }, [accessToken, toast]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? categories[0],
    [categories, selectedCategoryId],
  );

  const canSubmit = cart.length > 0 && (orderType !== 'DINE_IN' || tableNumber.trim().length > 0);

  const handleAddToCart = (item: { id: string; name: string; price: string }) => {
    addToCart({
      menuItemId: item.id,
      name: item.name,
      price: Number.parseFloat(item.price),
      quantity: 1,
      notes: null,
    });
    setCartIconAnimation(true);
    setTimeout(() => setCartIconAnimation(false), 250);
  };

  const handleConfirmOrder = async () => {
    if (!accessToken) {
      return;
    }

    const dto: CreateOrderDto =
      orderType === 'DINE_IN'
        ? {
            type: 'DINE_IN',
            tableNumber: tableNumber.trim(),
            notes: notes.trim() || undefined,
            items: cart.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              notes: item.notes,
            })),
          }
        : {
            type: 'TAKE_AWAY',
            notes: notes.trim() || undefined,
            items: cart.map((item) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              notes: item.notes,
            })),
          };

    setIsSubmitting(true);
    try {
      const createdOrder = await orderService.create(dto, accessToken);
      toast({
        variant: 'success',
        title: `Order #${createdOrder.dailyNumber} sent to the kitchen`,
      });
      clearCart();
      router.push('/app/orders');
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Failed to create order',
        message: error instanceof Error ? error.message : 'Try again',
      });
    } finally {
      setIsSubmitting(false);
      setIsConfirmOpen(false);
    }
  };

  return (
    <PageLayout className="space-y-4">
      <PageHeader
        title="New Order"
        subtitle="Create and send a new order"
        action={
          <div className="relative">
            <IconButton
              icon={<ShoppingCart size={20} />}
              label="Open cart"
              variant="secondary"
              className={cartIconAnimation ? 'animate-cart-nudge' : undefined}
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

      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategoryId === category.id ? 'primary' : 'secondary'}
            size="sm"
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
            onAdd={() => handleAddToCart(item)}
          />
        ))}
      </div>

      <div className="rounded-md border border-stone-200 bg-white p-4">
        <div className="mb-3 flex gap-2">
          <Button
            variant={orderType === 'DINE_IN' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setOrderType('DINE_IN')}
          >
            Dine-In
          </Button>
          <Button
            variant={orderType === 'TAKE_AWAY' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setOrderType('TAKE_AWAY')}
          >
            Take-Away
          </Button>
        </div>

        {orderType === 'DINE_IN' && (
          <Input
            label="Table Number"
            value={tableNumber}
            onChange={(event) => setTableNumber(event.target.value)}
            placeholder="e.g. 4"
          />
        )}

        <Textarea
          label="Order Notes"
          className="mt-3"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional instructions..."
        />

        <Button className="mt-4 w-full" disabled={!canSubmit} onClick={() => setIsConfirmOpen(true)}>
          Place Order
        </Button>
      </div>

      <CartBottomSheet isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} onSubmit={() => {
        setIsCartOpen(false);
        setIsConfirmOpen(true);
      }} />

      <OrderConfirmBottomSheet
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => void handleConfirmOrder()}
        isSubmitting={isSubmitting}
        orderType={orderType}
        tableNumber={tableNumber}
        notes={notes}
        cart={cart}
      />
    </PageLayout>
  );
}
