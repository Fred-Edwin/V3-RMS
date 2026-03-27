'use client';

import { useCallback, useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { useInventoryStore } from '@/store/inventoryStore';
import { useToast } from '@/hooks/useToast';
import type { StocktakeVariancePayload } from '@/types/inventory';

/**
 * Attaches Socket.io listeners for inventory:low_stock, inventory:out_of_stock,
 * and inventory:stocktake_variance events. Must be used on pages that have already
 * connected to the socket (e.g. via useActiveOrders or an explicit connectSocket
 * call in the parent layout).
 */
export function useInventorySocket() {
  const updateStockItem = useInventoryStore((s) => s.updateStockItem);
  const setItemUnavailable = useInventoryStore((s) => s.setItemUnavailable);
  const branchStock = useInventoryStore((s) => s.branchStock);
  const { toast } = useToast();

  const getMenuItemName = useCallback(
    (menuItemId: string) => {
      const item = branchStock.find((s) => s.menuItemId === menuItemId);
      return item?.menuItem?.name ?? 'An item';
    },
    [branchStock],
  );

  const handleStocktakeVariance = useCallback(
    (payload: StocktakeVariancePayload) => {
      toast({
        variant: 'warning',
        title: 'Stocktake Variance Alert',
        message: `${payload.highVarianceItems.length} item(s) with >10% variance detected`,
      });
    },
    [toast],
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleLowStock = (payload: { menuItemId: string; currentQty: number }) => {
      updateStockItem(payload.menuItemId, payload.currentQty);
      const name = getMenuItemName(payload.menuItemId);
      toast({ variant: 'warning', title: 'Low Stock', message: `${name} is down to ${payload.currentQty} portions` });
    };

    const handleOutOfStock = (payload: { menuItemId: string }) => {
      setItemUnavailable(payload.menuItemId);
      const name = getMenuItemName(payload.menuItemId);
      toast({ variant: 'error', title: 'Out of Stock', message: `${name} is out of stock — hidden from menu` });
    };

    socket.on('inventory:low_stock', handleLowStock);
    socket.on('inventory:out_of_stock', handleOutOfStock);
    socket.on('inventory:stocktake_variance', handleStocktakeVariance);

    return () => {
      socket.off('inventory:low_stock', handleLowStock);
      socket.off('inventory:out_of_stock', handleOutOfStock);
      socket.off('inventory:stocktake_variance', handleStocktakeVariance);
    };
  }, [getMenuItemName, handleStocktakeVariance, setItemUnavailable, toast, updateStockItem]);
}
