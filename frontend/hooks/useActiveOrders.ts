import { useCallback, useEffect } from 'react';
import { connectSocket, getSocket, joinBranchRoom, joinUserRoom, onReconnect } from '@/lib/socket';
import { orderService } from '@/services/orderService';
import { useAuthStore } from '@/store/authStore';
import { useOrderStore } from '@/store/orderStore';

export function useActiveOrders() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const organizationId = useAuthStore((state) => state.organizationId);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const role = useAuthStore((state) => state.role);

  const activeOrders = useOrderStore((state) => state.activeOrders);
  const isLoading = useOrderStore((state) => state.isLoading);
  const error = useOrderStore((state) => state.error);
  const setActiveOrders = useOrderStore((state) => state.setActiveOrders);
  const setLoading = useOrderStore((state) => state.setLoading);
  const setError = useOrderStore((state) => state.setError);
  const updateOrderRealTime = useOrderStore((state) => state.updateOrderRealTime);
  const removeOrderFromActive = useOrderStore((state) => state.removeOrderFromActive);

  const loadActiveOrders = useCallback(async () => {
    if (!accessToken || (role !== 'WAITER' && role !== 'MANAGER')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const orders = await orderService.getActive(accessToken, 'summary');
      setActiveOrders(orders);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load active orders';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, role, setActiveOrders, setError, setLoading]);

  useEffect(() => {
    void loadActiveOrders();
  }, [loadActiveOrders]);

  useEffect(() => {
    if (!accessToken || !organizationId || !userId || (role !== 'WAITER' && role !== 'MANAGER')) {
      return;
    }

    connectSocket(accessToken);
    joinBranchRoom(organizationId);
    joinUserRoom(userId);

    const socket = getSocket();
    if (!socket) {
      return;
    }

    const handleOrderClaimed = (payload: { orderId: string }) => {
      updateOrderRealTime(payload.orderId, { status: 'IN_PROGRESS' });
    };

    const handleOrderAllReady = (payload: { orderId: string }) => {
      updateOrderRealTime(payload.orderId, { status: 'READY' });
    };

    const handleOrderCancelled = (payload: { orderId: string }) => {
      removeOrderFromActive(payload.orderId);
    };

    socket.on('order:claimed', handleOrderClaimed);
    socket.on('order:all_ready', handleOrderAllReady);
    socket.on('order:cancelled', handleOrderCancelled);

    const offReconnect = onReconnect(() => {
      void loadActiveOrders();
    });

    return () => {
      socket.off('order:claimed', handleOrderClaimed);
      socket.off('order:all_ready', handleOrderAllReady);
      socket.off('order:cancelled', handleOrderCancelled);
      offReconnect();
    };
  }, [
    accessToken,
    loadActiveOrders,
    organizationId,
    removeOrderFromActive,
    role,
    updateOrderRealTime,
    userId,
  ]);

  return { activeOrders, isLoading, error, reload: loadActiveOrders };
}
