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
    if (!accessToken || (role !== 'WAITER' && role !== 'MANAGER' && role !== 'DIRECTOR')) {
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
    if (!accessToken || !organizationId || !userId || (role !== 'WAITER' && role !== 'MANAGER' && role !== 'DIRECTOR')) {
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
      const current = useOrderStore.getState().activeOrders.find((order) => order.id === payload.orderId);
      if (current?.status === 'AWAITING_CANCELLATION_APPROVAL') {
        return;
      }
      updateOrderRealTime(payload.orderId, { status: 'READY' });
    };

    const handleOrderCancelled = (payload: { orderId: string }) => {
      removeOrderFromActive(payload.orderId);
    };

    socket.on('order:claimed', handleOrderClaimed);
    socket.on('order:all_ready', handleOrderAllReady);
    socket.on('order:cancelled', handleOrderCancelled);

    const handleForceCancelled = (payload: { orderId: string }) => {
      removeOrderFromActive(payload.orderId);
    };

    socket.on('order:force_cancelled', handleForceCancelled);

    const handleCancellationPending = (payload: { orderId: string }) => {
      updateOrderRealTime(payload.orderId, { status: 'AWAITING_CANCELLATION_APPROVAL' });
    };

    const handleCancellationResolved = (payload: { orderId: string; approved: boolean; restoredStatus?: string }) => {
      if (payload.approved) {
        removeOrderFromActive(payload.orderId);
      } else {
        updateOrderRealTime(payload.orderId, {
          status: payload.restoredStatus === 'PENDING' || payload.restoredStatus === 'IN_PROGRESS' || payload.restoredStatus === 'READY'
            ? payload.restoredStatus
            : 'IN_PROGRESS',
        });
      }
    };

    socket.on('order:cancellation_pending', handleCancellationPending);
    socket.on('order:cancellation_resolved', handleCancellationResolved);

    // House account authorization events
    const handleAuthPending = (payload: { orderId: string }) => {
      updateOrderRealTime(payload.orderId, { status: 'AWAITING_AUTHORIZATION' });
    };

    const handleAuthResolved = (payload: { orderId: string; approved: boolean }) => {
      if (payload.approved) {
        // Order will be closed — remove from active list
        removeOrderFromActive(payload.orderId);
      } else {
        // Rejected/timed out — order returns to READY
        updateOrderRealTime(payload.orderId, { status: 'READY' });
      }
    };

    socket.on('order:auth_pending', handleAuthPending);
    socket.on('order:auth_resolved', handleAuthResolved);

    const offReconnect = onReconnect(() => {
      joinBranchRoom(organizationId);
      joinUserRoom(userId);
      void loadActiveOrders();
    });

    return () => {
      socket.off('order:claimed', handleOrderClaimed);
      socket.off('order:all_ready', handleOrderAllReady);
      socket.off('order:cancelled', handleOrderCancelled);
      socket.off('order:force_cancelled', handleForceCancelled);
      socket.off('order:cancellation_pending', handleCancellationPending);
      socket.off('order:cancellation_resolved', handleCancellationResolved);
      socket.off('order:auth_pending', handleAuthPending);
      socket.off('order:auth_resolved', handleAuthResolved);
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
