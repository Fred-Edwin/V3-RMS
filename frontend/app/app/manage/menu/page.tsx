'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EmptyState,
  MenuItemCard,
  MobileLayout,
  PageHeader,
  PageLayout,
  Toggle,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { menuService } from '@/services/menuService';
import { useAuthStore } from '@/store/authStore';
import type { MenuCategoryWithAvailability } from '@/types/menu';
import { ApiError } from '@/types/api';
import { UtensilsCrossed } from 'lucide-react';

const updateMenuItemAvailability = (
  categories: MenuCategoryWithAvailability[],
  menuItemId: string,
  isAvailable: boolean,
): MenuCategoryWithAvailability[] => {
  return categories.map((category) => ({
    ...category,
    items: category.items.map((item) => (item.id === menuItemId ? { ...item, isAvailable } : item)),
  }));
};

const getItemAvailability = (
  categories: MenuCategoryWithAvailability[],
  menuItemId: string,
): boolean | null => {
  for (const category of categories) {
    const found = category.items.find((item) => item.id === menuItemId);
    if (found) {
      return found.isAvailable;
    }
  }

  return null;
};

export default function Page(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [categories, setCategories] = useState<MenuCategoryWithAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingItemIds, setPendingItemIds] = useState<string[]>([]);

  const categoryCount = useMemo(() => categories.length, [categories]);

  const loadMenu = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    try {
      const menu = await menuService.getMenu(accessToken);
      setCategories(menu.categories);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load branch menu.';
      toast({
        variant: 'error',
        title: 'Load failed',
        message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  const handleToggleAvailability = async (menuItemId: string, nextState: boolean): Promise<void> => {
    if (!accessToken) {
      return;
    }

    const previousState = getItemAvailability(categories, menuItemId);
    if (previousState === null) {
      return;
    }

    setCategories((prev) => updateMenuItemAvailability(prev, menuItemId, nextState));
    setPendingItemIds((prev) => [...prev, menuItemId]);

    try {
      await menuService.setItemAvailability(menuItemId, nextState, accessToken);
      toast({
        variant: 'success',
        title: nextState ? 'Item is available' : 'Item marked unavailable',
      });
    } catch (error) {
      setCategories((prev) => updateMenuItemAvailability(prev, menuItemId, previousState));
      const message = error instanceof ApiError ? error.message : 'Failed to update availability.';
      toast({
        variant: 'error',
        title: 'Update failed',
        message,
      });
    } finally {
      setPendingItemIds((prev) => prev.filter((id) => id !== menuItemId));
    }
  };

  return (
    <MobileLayout>
      <PageLayout className="max-w-5xl">
        <PageHeader
          title="Branch Menu Availability"
          subtitle={`Manage item availability across ${categoryCount} categories.`}
        />

        {isLoading ? <p className="text-body-md text-stone-500">Loading menu...</p> : null}

        {!isLoading && categories.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed size={28} />}
            heading="No menu items available"
            body="The master menu has no active items yet."
          />
        ) : null}

        <div className="space-y-8">
          {categories.map((category) => (
            <section key={category.id} className="space-y-3">
              <div>
                <h2 className="text-heading-md font-semibold text-stone-900">{category.name}</h2>
                <p className="text-body-sm text-stone-500">{category.prepStation}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {category.items.map((item) => {
                  const parsedPrice = Number.parseFloat(item.price);

                  return (
                    <div key={item.id} className="rounded-md border border-stone-200 bg-white p-3 shadow-sm">
                      <MenuItemCard
                        name={item.name}
                        description={item.description ?? undefined}
                        price={Number.isNaN(parsedPrice) ? 0 : parsedPrice}
                        isAvailable={item.isAvailable}
                      />
                      <div className="mt-3 flex items-center justify-between">
                        <Toggle
                          checked={item.isAvailable}
                          onChange={(checked) => void handleToggleAvailability(item.id, checked)}
                          disabled={pendingItemIds.includes(item.id)}
                          label={item.isAvailable ? 'Available' : 'Unavailable'}
                        />
                        {!item.isAvailable ? (
                          <span className="inline-flex rounded-full border border-[#F5A898] bg-[#FDF2F0] px-2 py-0.5 text-label-sm text-[#9B3A2A]">
                            Unavailable
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </PageLayout>
    </MobileLayout>
  );
}
