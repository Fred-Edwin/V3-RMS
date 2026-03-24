'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { ImageOff, Plus, Search, UtensilsCrossed } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeader,
  PageLayout,
  PriceDisplay,
  Select,
  Table,
  Textarea,
  type TableColumn,
  Toggle,
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { menuService } from '@/services/menuService';
import { useAuthStore } from '@/store/authStore';
import type {
  CreateCategoryInput,
  CreateItemInput,
  MenuCategorySummary,
  MenuManagementItem,
  PrepStation,
  UpdateCategoryInput,
  UpdateItemInput,
} from '@/types/menu';
import { ApiError } from '@/types/api';

type CategoryRow = Record<string, unknown> & {
  id: string;
  name: string;
  prepStation: PrepStation;
  itemCount: number;
  isActive: boolean;
  category: MenuCategorySummary;
};

type CategoryStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface FilteredCategorySection {
  category: MenuCategorySummary;
  visibleItems: MenuManagementItem[];
}

interface CategoryFormState {
  name: string;
  prepStation: PrepStation;
  displayOrder: string;
  isActive: boolean;
}

interface ItemFormState {
  categoryId: string;
  name: string;
  description: string;
  imageUrl: string;
  price: string;
  isActive: boolean;
}

const initialCategoryForm: CategoryFormState = {
  name: '',
  prepStation: 'KITCHEN',
  displayOrder: '0',
  isActive: true,
};

const initialItemForm: ItemFormState = {
  categoryId: '',
  name: '',
  description: '',
  imageUrl: '',
  price: '',
  isActive: true,
};

const prepStationBadgeClass: Record<PrepStation, string> = {
  KITCHEN: 'bg-[#FEF0E0] text-[#A04F0A] border border-[#F5B87A]',
  BARISTA: 'bg-[#EDFAF1] text-[#1A6B3C] border border-[#86EFAC]',
  PIZZA: 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]',
  PASTRY: 'bg-[#FEF9C3] text-[#854D0E] border border-[#FDE047]',
};

const prepStationLabel: Record<PrepStation, string> = {
  KITCHEN: 'Kitchen',
  BARISTA: 'Barista',
  PIZZA: 'Pizza',
  PASTRY: 'Pastry',
};

export default function Page(): JSX.Element {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { toast } = useToast();

  const [categories, setCategories] = useState<MenuCategorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryModalMode, setCategoryModalMode] = useState<'create' | 'edit'>('create');
  const [editingCategory, setEditingCategory] = useState<MenuCategorySummary | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(initialCategoryForm);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalMode, setItemModalMode] = useState<'create' | 'edit'>('create');
  const [editingItem, setEditingItem] = useState<MenuManagementItem | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>(initialItemForm);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [prepStationFilter, setPrepStationFilter] = useState<'ALL' | PrepStation>('ALL');
  const [statusFilter, setStatusFilter] = useState<CategoryStatusFilter>('ALL');

  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<MenuCategorySummary | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<MenuManagementItem | null>(null);

  const loadCategories = useCallback(async (): Promise<void> => {
    if (!accessToken) {
      return;
    }

    setIsLoading(true);
    try {
      const data = await menuService.getCategories(accessToken);
      setCategories(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load menu categories.';
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
    void loadCategories();
  }, [loadCategories]);

  const handleImageFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.target.files?.[0];
      if (!file || !accessToken) {
        return;
      }
      setIsUploadingImage(true);
      try {
        const { imageUrl } = await menuService.uploadItemImage(file, accessToken);
        setItemForm((prev) => ({ ...prev, imageUrl }));
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Image upload failed.';
        toast({ variant: 'error', title: 'Upload failed', message });
      } finally {
        setIsUploadingImage(false);
        if (imageInputRef.current) {
          imageInputRef.current.value = '';
        }
      }
    },
    [accessToken, toast],
  );

  const normalizedSearchTerm = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm]);

  const filteredCategorySections = useMemo<FilteredCategorySection[]>(() => {
    return categories.flatMap((category) => {
      if (prepStationFilter !== 'ALL' && category.prepStation !== prepStationFilter) {
        return [];
      }

      if (statusFilter === 'ACTIVE' && !category.isActive) {
        return [];
      }

      if (statusFilter === 'INACTIVE' && category.isActive) {
        return [];
      }

      if (!normalizedSearchTerm) {
        return [{ category, visibleItems: category.items }];
      }

      const categoryNameMatches = category.name.toLowerCase().includes(normalizedSearchTerm);
      if (categoryNameMatches) {
        return [{ category, visibleItems: category.items }];
      }

      const matchingItems = category.items.filter((item) => {
        const normalizedName = item.name.toLowerCase();
        const normalizedDescription = item.description?.toLowerCase() ?? '';
        return normalizedName.includes(normalizedSearchTerm) || normalizedDescription.includes(normalizedSearchTerm);
      });

      if (matchingItems.length === 0) {
        return [];
      }

      return [{ category, visibleItems: matchingItems }];
    });
  }, [categories, normalizedSearchTerm, prepStationFilter, statusFilter]);

  const categoryRows = useMemo<CategoryRow[]>(() => {
    return filteredCategorySections.map(({ category, visibleItems }) => ({
      id: category.id,
      name: category.name,
      prepStation: category.prepStation,
      itemCount: normalizedSearchTerm ? visibleItems.length : category.itemCount,
      isActive: category.isActive,
      category,
    }));
  }, [filteredCategorySections, normalizedSearchTerm]);

  const hasActiveFilters = normalizedSearchTerm.length > 0 || prepStationFilter !== 'ALL' || statusFilter !== 'ALL';

  const handleResetFilters = (): void => {
    setSearchTerm('');
    setPrepStationFilter('ALL');
    setStatusFilter('ALL');
  };

  const categoryColumns = useMemo<TableColumn<CategoryRow>[]>(() => {
    return [
      {
        key: 'name',
        label: 'Category',
      },
      {
        key: 'prepStation',
        label: 'Prep Station',
        render: (value) => {
          const station = value as PrepStation;
          return (
            <span
              className={`inline-flex rounded-full px-3 py-1 text-label-sm font-medium ${prepStationBadgeClass[station]}`}
            >
              {station}
            </span>
          );
        },
      },
      {
        key: 'itemCount',
        label: 'Item Count',
      },
      {
        key: 'isActive',
        label: 'Status',
        render: (value) => (value ? 'Active' : 'Inactive'),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (_value, row) => (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setCategoryModalMode('edit');
                setEditingCategory(row.category);
                setCategoryForm({
                  name: row.category.name,
                  prepStation: row.category.prepStation,
                  displayOrder: String(row.category.displayOrder),
                  isActive: row.category.isActive,
                });
                setCategoryModalOpen(true);
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDeleteCategoryTarget(row.category);
              }}
            >
              Delete
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setItemModalMode('create');
                setEditingItem(null);
                setItemForm({
                  ...initialItemForm,
                  categoryId: row.category.id,
                });
                setItemModalOpen(true);
              }}
            >
              Add Item
            </Button>
          </div>
        ),
      },
    ];
  }, []);

  const handleOpenCreateCategory = (): void => {
    setCategoryModalMode('create');
    setEditingCategory(null);
    setCategoryForm(initialCategoryForm);
    setCategoryModalOpen(true);
  };

  const handleSubmitCategory = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    const displayOrder = Number.parseInt(categoryForm.displayOrder, 10);
    if (Number.isNaN(displayOrder) || displayOrder < 0) {
      toast({
        variant: 'warning',
        title: 'Invalid display order',
        message: 'Display order must be a number greater than or equal to 0.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (categoryModalMode === 'create') {
        const payload: CreateCategoryInput = {
          name: categoryForm.name.trim(),
          prepStation: categoryForm.prepStation,
          displayOrder,
        };
        await menuService.createCategory(payload, accessToken);
      } else if (editingCategory) {
        const payload: UpdateCategoryInput = {
          name: categoryForm.name.trim(),
          prepStation: categoryForm.prepStation,
          displayOrder,
          isActive: categoryForm.isActive,
        };
        await menuService.updateCategory(editingCategory.id, payload, accessToken);
      }

      toast({
        variant: 'success',
        title: categoryModalMode === 'create' ? 'Category created' : 'Category updated',
      });
      setCategoryModalOpen(false);
      await loadCategories();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to save category.';
      toast({
        variant: 'error',
        title: 'Save failed',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteCategory = async (): Promise<void> => {
    if (!accessToken || !deleteCategoryTarget) {
      return;
    }

    setIsSubmitting(true);
    try {
      await menuService.deleteCategory(deleteCategoryTarget.id, accessToken);
      toast({
        variant: 'success',
        title: 'Category deleted',
      });
      setDeleteCategoryTarget(null);
      await loadCategories();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to delete category.';
      toast({
        variant: 'error',
        title: 'Delete blocked',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitItem = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!accessToken) {
      return;
    }

    const trimmedName = itemForm.name.trim();
    const trimmedDescription = itemForm.description.trim();
    const parsedPrice = Number.parseFloat(itemForm.price);

    if (!trimmedName || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      toast({
        variant: 'warning',
        title: 'Invalid item input',
        message: 'Name and a positive price are required.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (itemModalMode === 'create') {
        const payload: CreateItemInput = {
          categoryId: itemForm.categoryId,
          name: trimmedName,
          description: trimmedDescription || undefined,
          imageUrl: itemForm.imageUrl || undefined,
          price: parsedPrice.toFixed(2),
        };
        await menuService.createItem(payload, accessToken);
      } else if (editingItem) {
        const payload: UpdateItemInput = {
          categoryId: itemForm.categoryId,
          name: trimmedName,
          description: trimmedDescription || undefined,
          imageUrl: itemForm.imageUrl || undefined,
          price: parsedPrice.toFixed(2),
          isActive: itemForm.isActive,
        };
        await menuService.updateItem(editingItem.id, payload, accessToken);
      }

      toast({
        variant: 'success',
        title: itemModalMode === 'create' ? 'Item created' : 'Item updated',
      });
      setItemModalOpen(false);
      await loadCategories();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to save item.';
      toast({
        variant: 'error',
        title: 'Save failed',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteItem = async (): Promise<void> => {
    if (!accessToken || !deleteItemTarget) {
      return;
    }

    setIsSubmitting(true);
    try {
      await menuService.deleteItem(deleteItemTarget.id, accessToken);
      toast({
        variant: 'success',
        title: 'Item deleted',
      });
      setDeleteItemTarget(null);
      await loadCategories();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to delete item.';
      toast({
        variant: 'error',
        title: 'Delete failed',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageLayout className="animate-fade-up space-y-6">
        <PageHeader
          title="Menu Management"
          titleClassName="font-display text-display-lg font-semibold text-espresso"
          subtitle="Create and maintain master categories and items."
          action={
            <Button type="button" leftIcon={<Plus size={16} />} onClick={handleOpenCreateCategory}>
              Add Category
            </Button>
          }
        />

        {isLoading ? (
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-body-md text-stone-500">Loading menu categories…</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filter bar */}
            <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,2fr)_180px_180px_auto] sm:items-end">
                <div className="col-span-2 sm:col-span-1">
                  <Input
                    id="menu-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search categories or items"
                    leftIcon={<Search size={16} />}
                  />
                </div>
                <Select
                  id="menu-prep-station-filter"
                  value={prepStationFilter}
                  onChange={(event) => setPrepStationFilter(event.target.value as 'ALL' | PrepStation)}
                  options={[
                    { value: 'ALL', label: 'All stations' },
                    { value: 'KITCHEN', label: 'Kitchen' },
                    { value: 'BARISTA', label: 'Barista' },
                    { value: 'PIZZA', label: 'Pizza' },
                    { value: 'PASTRY', label: 'Pastry' },
                  ]}
                />
                <Select
                  id="menu-status-filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as CategoryStatusFilter)}
                  options={[
                    { value: 'ALL', label: 'All statuses' },
                    { value: 'ACTIVE', label: 'Active only' },
                    { value: 'INACTIVE', label: 'Inactive only' },
                  ]}
                />
                <button
                  type="button"
                  className="h-10 rounded-md border border-stone-200 px-3 text-label-md font-medium text-stone-700 disabled:opacity-40"
                  onClick={handleResetFilters}
                  disabled={!hasActiveFilters}
                >
                  Clear
                </button>
              </div>
            </section>

            {/* Categories summary table */}
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="mb-4 text-heading-md font-semibold text-stone-900">Categories</h2>
              <Table<CategoryRow>
                columns={categoryColumns}
                data={categoryRows}
                keyField="id"
                emptyState={
                  <EmptyState
                    icon={<UtensilsCrossed size={28} />}
                    heading="No categories yet"
                    body="Create your first category to begin building the master menu."
                    action={
                      <Button type="button" leftIcon={<Plus size={14} />} onClick={handleOpenCreateCategory}>
                        Add Category
                      </Button>
                    }
                  />
                }
              />
            </div>

            {/* Per-category item lists */}
            <div className="space-y-4">
              {filteredCategorySections.map(({ category, visibleItems }) => (
                <section key={category.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-heading-md font-semibold text-stone-900">{category.name}</h2>
                      <p className="text-body-sm text-stone-400">
                        {prepStationLabel[category.prepStation]} · {visibleItems.length} item{visibleItems.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      leftIcon={<Plus size={14} />}
                      onClick={() => {
                        setItemModalMode('create');
                        setEditingItem(null);
                        setItemForm({ ...initialItemForm, categoryId: category.id });
                        setItemModalOpen(true);
                      }}
                    >
                      Add Item
                    </Button>
                  </div>

                  {visibleItems.length === 0 ? (
                    <p className="text-body-sm text-stone-400">No items in this category yet.</p>
                  ) : (
                    <div className="w-full overflow-x-auto">
                      <table className="w-full min-w-[560px]">
                        <thead>
                          <tr className="border-b-2 border-stone-100">
                            <th className="h-9 px-3 text-left text-label-sm font-semibold uppercase tracking-wider text-stone-400">
                              Item
                            </th>
                            <th className="h-9 px-3 text-left text-label-sm font-semibold uppercase tracking-wider text-stone-400">
                              Price
                            </th>
                            <th className="h-9 px-3 text-left text-label-sm font-semibold uppercase tracking-wider text-stone-400">
                              Status
                            </th>
                            <th className="h-9 px-3 text-label-sm font-semibold uppercase tracking-wider text-stone-400" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {visibleItems.map((item) => {
                            const numericPrice = Number.parseFloat(item.price);
                            return (
                              <tr key={item.id}>
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-3">
                                    {item.imageUrl ? (
                                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-stone-100">
                                        <Image src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="36px" />
                                      </div>
                                    ) : null}
                                    <div>
                                      <p className="text-body-sm font-medium text-stone-900">{item.name}</p>
                                      {item.description ? (
                                        <p className="max-w-[220px] truncate text-caption text-stone-400">{item.description}</p>
                                      ) : null}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  <PriceDisplay amount={Number.isNaN(numericPrice) ? 0 : numericPrice} />
                                </td>
                                <td className="px-3 py-3">
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-0.5 text-label-sm font-medium ${
                                      item.isActive
                                        ? 'border border-[#86EFAC] bg-[#EDFAF1] text-[#1A6B3C]'
                                        : 'border border-[#D4D4D8] bg-[#F4F4F5] text-[#71717A]'
                                    }`}
                                  >
                                    {item.isActive ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setItemModalMode('edit');
                                        setEditingItem(item);
                                        setItemForm({
                                          categoryId: item.categoryId,
                                          name: item.name,
                                          description: item.description ?? '',
                                          imageUrl: item.imageUrl ?? '',
                                          price: item.price,
                                          isActive: item.isActive,
                                        });
                                        setItemModalOpen(true);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeleteItemTarget(item)}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        )}
      </PageLayout>

      <Modal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={categoryModalMode === 'create' ? 'Create Category' : 'Edit Category'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setCategoryModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" isLoading={isSubmitting}>
              {categoryModalMode === 'create' ? 'Create' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <form id="category-form" className="space-y-4" onSubmit={(event) => void handleSubmitCategory(event)}>
          <FormField label="Category Name" htmlFor="category-name" required>
            <Input
              id="category-name"
              value={categoryForm.name}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g. Hot Drinks"
            />
          </FormField>
          <FormField label="Prep Station" htmlFor="category-prep-station" required>
            <Select
              id="category-prep-station"
              value={categoryForm.prepStation}
              onChange={(event) =>
                setCategoryForm((prev) => ({
                  ...prev,
                  prepStation: event.target.value as PrepStation,
                }))
              }
              options={[
                { value: 'KITCHEN', label: 'Kitchen' },
                { value: 'BARISTA', label: 'Barista' },
                { value: 'PIZZA', label: 'Pizza' },
                { value: 'PASTRY', label: 'Pastry' },
              ]}
            />
          </FormField>
          <FormField label="Display Order" htmlFor="category-display-order" required>
            <Input
              id="category-display-order"
              type="number"
              min="0"
              value={categoryForm.displayOrder}
              onChange={(event) => setCategoryForm((prev) => ({ ...prev, displayOrder: event.target.value }))}
            />
          </FormField>
          {categoryModalMode === 'edit' ? (
            <div className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
              <Toggle
                checked={categoryForm.isActive}
                onChange={(checked) => setCategoryForm((prev) => ({ ...prev, isActive: checked }))}
                label={categoryForm.isActive ? 'Category is active — visible on menus' : 'Category is inactive — hidden from menus'}
              />
            </div>
          ) : null}
        </form>
      </Modal>

      <Modal
        isOpen={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title={itemModalMode === 'create' ? 'Create Item' : 'Edit Item'}
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setItemModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="item-form" isLoading={isSubmitting}>
              {itemModalMode === 'create' ? 'Create' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <form id="item-form" className="space-y-4" onSubmit={(event) => void handleSubmitItem(event)}>
          <FormField label="Category" htmlFor="item-category" required>
            <Select
              id="item-category"
              value={itemForm.categoryId}
              onChange={(event) => setItemForm((prev) => ({ ...prev, categoryId: event.target.value }))}
              placeholder="Select category"
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
          </FormField>
          <FormField label="Item Name" htmlFor="item-name" required>
            <Input
              id="item-name"
              value={itemForm.name}
              onChange={(event) => setItemForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g. Cappuccino"
            />
          </FormField>
          <FormField label="Description" htmlFor="item-description">
            <Textarea
              id="item-description"
              value={itemForm.description}
              onChange={(event) => setItemForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Optional description"
            />
          </FormField>
          <FormField label="Image" htmlFor="item-image">
            <div className="flex items-start gap-4">
              <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 shadow-sm">
                {itemForm.imageUrl ? (
                  <Image src={itemForm.imageUrl} alt="Item preview" fill className="object-cover" sizes="112px" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1">
                    <ImageOff size={22} className="text-stone-300" />
                    <span className="text-caption text-stone-300">No image</span>
                  </div>
                )}
                {isUploadingImage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                    <span className="text-label-sm font-medium text-stone-500">Uploading…</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isUploadingImage}
                  onClick={() => imageInputRef.current?.click()}
                >
                  {itemForm.imageUrl ? 'Change Image' : 'Upload Image'}
                </Button>
                {itemForm.imageUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setItemForm((prev) => ({ ...prev, imageUrl: '' }))}
                  >
                    Remove
                  </Button>
                ) : null}
                <p className="text-caption text-stone-400">JPG, PNG or WebP</p>
                <input
                  ref={imageInputRef}
                  id="item-image"
                  type="file"
                  accept=".webp,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(event) => void handleImageFileChange(event)}
                />
              </div>
            </div>
          </FormField>
          <FormField label="Price (KES)" htmlFor="item-price" required>
            <Input
              id="item-price"
              type="number"
              min="0"
              step="0.01"
              value={itemForm.price}
              onChange={(event) => setItemForm((prev) => ({ ...prev, price: event.target.value }))}
              placeholder="0.00"
            />
          </FormField>
          {itemModalMode === 'edit' ? (
            <div className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
              <Toggle
                checked={itemForm.isActive}
                onChange={(checked) => setItemForm((prev) => ({ ...prev, isActive: checked }))}
                label={itemForm.isActive ? 'Item is active — orderable by waiters' : 'Item is inactive — hidden from order flow'}
              />
            </div>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteCategoryTarget}
        onClose={() => setDeleteCategoryTarget(null)}
        onConfirm={() => void handleConfirmDeleteCategory()}
        title="Delete category?"
        description={`Delete "${deleteCategoryTarget?.name ?? ''}" from the master menu.`}
        confirmLabel="Delete Category"
        cancelLabel="Cancel"
        isLoading={isSubmitting}
      />

      <ConfirmDialog
        isOpen={!!deleteItemTarget}
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={() => void handleConfirmDeleteItem()}
        title="Delete item?"
        description={`Delete "${deleteItemTarget?.name ?? ''}" from the master menu.`}
        confirmLabel="Delete Item"
        cancelLabel="Cancel"
        isLoading={isSubmitting}
      />
    </>
  );
}
