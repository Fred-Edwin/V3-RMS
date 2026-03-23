import { create } from 'zustand';
import { inventoryService } from '@/services/inventoryService';
import type { BranchStockItem, Requisition } from '@/types/inventory';

interface InventoryStore {
  branchStock: BranchStockItem[];
  requisitions: Requisition[];
  activeRequisition: Requisition | null;
  isLoadingStock: boolean;
  isLoadingRequisitions: boolean;

  fetchBranchStock: (token: string) => Promise<void>;
  fetchRequisitions: (token: string) => Promise<void>;
  updateStockItem: (menuItemId: string, newQty: number) => void;
  setItemUnavailable: (menuItemId: string) => void;
  setActiveRequisition: (requisition: Requisition | null) => void;
}

export const useInventoryStore = create<InventoryStore>((set) => ({
  branchStock: [],
  requisitions: [],
  activeRequisition: null,
  isLoadingStock: false,
  isLoadingRequisitions: false,

  fetchBranchStock: async (token: string) => {
    set({ isLoadingStock: true });
    try {
      const stock = await inventoryService.getBranchStock(token);
      set({ branchStock: stock });
    } finally {
      set({ isLoadingStock: false });
    }
  },

  fetchRequisitions: async (token: string) => {
    set({ isLoadingRequisitions: true });
    try {
      const requisitions = await inventoryService.getRequisitionsForBranch({}, token);
      set({ requisitions });
    } finally {
      set({ isLoadingRequisitions: false });
    }
  },

  updateStockItem: (menuItemId: string, newQty: number) => {
    set((state) => ({
      branchStock: state.branchStock.map((item) =>
        item.menuItemId === menuItemId ? { ...item, currentQty: newQty } : item,
      ),
    }));
  },

  setItemUnavailable: (menuItemId: string) => {
    set((state) => ({
      branchStock: state.branchStock.map((item) =>
        item.menuItemId === menuItemId ? { ...item, currentQty: 0 } : item,
      ),
    }));
  },

  setActiveRequisition: (requisition: Requisition | null) => {
    set({ activeRequisition: requisition });
  },
}));
