'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EmptyState,
  Input,
  MenuItemCard,
  PageHeader,
  PageLayout,
  Select,
  Toggle,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { menuService } from '@/services/menuService';
import { useAuthStore } from '@/store/authStore';
import type { MenuCategoryWithAvailability } from '@/types/menu';
import { ApiError } from '@/types/api';
import { Search, UtensilsCrossed } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [prepStationFilter, setPrepStationFilter] = useState<'ALL' | 'KITCHEN' | 'BARISTA'>('ALL');
  const [availabilityFilter, setAvailabilityFilter] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE'>('ALL');

  const categoryCount = useMemo(() => categories.length, [categories]);
  const normalizedSearchTerm = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  const filteredCategories = useMemo(() => {
    return categories.flatMap((category) => {
      if (prepStationFilter !== 'ALL' && category.prepStation !== prepStationFilter) {
        return [];
      }

      const visibleItems = category.items.filter((item) => {
        const matchesSearch =
          normalizedSearchTerm.length === 0 ||
          item.name.toLowerCase().includes(normalizedSearchTerm) ||
          (item.description?.toLowerCase().includes(normalizedSearchTerm) ?? false);

        const matchesAvailability =
          availabilityFilter === 'ALL' ||
          (availabilityFilter === 'AVAILABLE' && item.isAvailable) ||
          (availabilityFilter === 'UNAVAILABLE' && !item.isAvailable);

        return matchesSearch && matchesAvailability;
      });

      if (visibleItems.length === 0) {
        return [];
      }

      return [
        {
          ...category,
          items: visibleItems,
        },
      ];
    });
  }, [availabilityFilter, categories, normalizedSearchTerm, prepStationFilter]);

  const hasActiveFilters =
    normalizedSearchTerm.length > 0 || prepStationFilter !== 'ALL' || availabilityFilter !== 'ALL';

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
      <PageLayout className="max-w-5xl">
        <PageHeader
          title="Branch Menu Availability"
          subtitle={`Manage item availability across ${categoryCount} categories.`}
        />

        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_220px_220px_auto] lg:items-end">
            <Input
              id="branch-menu-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search menu items"
              leftIcon={<Search size={16} />}
            />
            <Select
              id="branch-menu-prep-station-filter"
              value={prepStationFilter}
              onChange={(event) => setPrepStationFilter(event.target.value as 'ALL' | 'KITCHEN' | 'BARISTA')}
              options={[
                { value: 'ALL', label: 'All stations' },
                { value: 'KITCHEN', label: 'KITCHEN' },
                { value: 'BARISTA', label: 'BARISTA' },
              ]}
            />
            <Select
              id="branch-menu-availability-filter"
              value={availabilityFilter}
              onChange={(event) => setAvailabilityFilter(event.target.value as 'ALL' | 'AVAILABLE' | 'UNAVAILABLE')}
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'AVAILABLE', label: 'Available' },
                { value: 'UNAVAILABLE', label: 'Unavailable' },
              ]}
            />
            <button
              type="button"
              className="h-10 rounded-md border border-stone-200 px-3 text-label-md font-medium text-stone-700 disabled:opacity-50"
              onClick={() => {
                setSearchTerm('');
                setPrepStationFilter('ALL');
                setAvailabilityFilter('ALL');
              }}
              disabled={!hasActiveFilters}
            >
              Clear Filters
            </button>
          </div>
        </section>

        {isLoading ? <p className="text-body-md text-stone-500">Loading menu...</p> : null}

        {!isLoading && filteredCategories.length === 0 ? (
          <EmptyState
            icon={<UtensilsCrossed size={28} />}
            heading={hasActiveFilters ? 'No items match your filters' : 'No menu items available'}
            body={
              hasActiveFilters
                ? 'Try adjusting your search or filter selection.'
                : 'The master menu has no active items yet.'
            }
          />
        ) : null}

        <div className="space-y-8">
          {filteredCategories.map((category) => (
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
  );
}
