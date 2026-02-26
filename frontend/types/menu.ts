export type PrepStation = 'KITCHEN' | 'BARISTA';

export interface MenuItemWithAvailability {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
}

export interface MenuCategoryWithAvailability {
  id: string;
  name: string;
  prepStation: PrepStation;
  displayOrder: number;
  items: MenuItemWithAvailability[];
}

export interface MenuResponse {
  categories: MenuCategoryWithAvailability[];
}

export interface MenuManagementItem {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  isActive: boolean;
}

export interface MenuCategorySummary {
  id: string;
  name: string;
  prepStation: PrepStation;
  displayOrder: number;
  isActive: boolean;
  itemCount: number;
  items: MenuManagementItem[];
}

export interface CreateCategoryInput {
  name: string;
  prepStation: PrepStation;
  displayOrder: number;
}

export interface UpdateCategoryInput {
  name?: string;
  prepStation?: PrepStation;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CreateItemInput {
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: string | number;
}

export interface UpdateItemInput {
  categoryId?: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  price?: string | number;
  isActive?: boolean;
}

export interface BranchMenuItemAvailability {
  id: string;
  organizationId: string;
  menuItemId: string;
  isAvailable: boolean;
  updatedAt: string;
  updatedBy: string;
}
