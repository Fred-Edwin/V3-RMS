import { useCallback, useEffect } from 'react';
import { connectSocket, getSocket, joinStationRoom, onReconnect } from '@/lib/socket';
import { prepTicketService } from '@/services/prepTicketService';
import { useAuthStore } from '@/store/authStore';
import { useKitchenStore } from '@/store/kitchenStore';
import type { PrepStation, PrepTicketStatus } from '@/types/order';

const stationFromRole = (role: string | null): PrepStation | null => {
  if (role === 'CHEF' || role === 'KITCHEN_DISPLAY') {
    return 'KITCHEN';
  }
  if (role === 'BARISTA' || role === 'BARISTA_DISPLAY') {
    return 'BARISTA';
  }
  return null;
};

export function usePrepTickets() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const organizationId = useAuthStore((state) => state.organizationId);
  const role = useAuthStore((state) => state.role);
  const station = stationFromRole(role);

  const pendingTickets = useKitchenStore((state) => state.pendingTickets);
  const inProgressTickets = useKitchenStore((state) => state.inProgressTickets);
  const readyTickets = useKitchenStore((state) => state.readyTickets);
  const isLoading = useKitchenStore((state) => state.isLoading);
  const error = useKitchenStore((state) => state.error);
  const setTickets = useKitchenStore((state) => state.setTickets);
  const addTicketRealTime = useKitchenStore((state) => state.addTicketRealTime);
  const updateTicketRealTime = useKitchenStore((state) => state.updateTicketRealTime);
  const removeOrderTickets = useKitchenStore((state) => state.removeOrderTickets);
  const setLoading = useKitchenStore((state) => state.setLoading);
  const setError = useKitchenStore((state) => state.setError);

  const loadTickets = useCallback(async () => {
    if (!accessToken || !station) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await prepTicketService.getTickets({ activeOnly: true }, accessToken);
      setTickets(response.tickets);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load prep tickets';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, setError, setLoading, setTickets, station]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (!accessToken || !organizationId || !station) {
      return;
    }

    connectSocket(accessToken);
    joinStationRoom(organizationId, station);

    const socket = getSocket();
    if (!socket) {
      return;
    }

    const handleNewOrder = (ticket: { id: string; station: PrepStation }) => {
      if (ticket.station !== station) {
        return;
      }
      void loadTickets();
    };

    const handleOrderModified = (ticket: { id: string; station: PrepStation; status: PrepTicketStatus }) => {
      if (ticket.station !== station) {
        return;
      }
      updateTicketRealTime(ticket.id, { status: ticket.status });
      void loadTickets();
    };

    const handleOrderCancelled = (payload: { orderId: string }) => {
      removeOrderTickets(payload.orderId);
    };

    const handleOrderClosed = (payload: { orderId: string }) => {
      removeOrderTickets(payload.orderId);
    };

    const handleOrderClaimed = (payload: { ticketId: string; station: PrepStation }) => {
      if (payload.station !== station) return;
      updateTicketRealTime(payload.ticketId, { status: 'IN_PROGRESS' });
    };

    const handleTicketUnclaimed = (payload: { ticketId: string; station: PrepStation }) => {
      if (payload.station !== station) return;
      updateTicketRealTime(payload.ticketId, { status: 'PENDING' });
    };

    socket.on('order:new', handleNewOrder);
    socket.on('order:modified', handleOrderModified);
    socket.on('order:cancelled', handleOrderCancelled);
    socket.on('order:closed', handleOrderClosed);
    socket.on('order:claimed', handleOrderClaimed);
    socket.on('ticket:unclaimed', handleTicketUnclaimed);

    const handleForceCancelled = (payload: { orderId: string }) => {
      removeOrderTickets(payload.orderId);
    };

    socket.on('order:force_cancelled', handleForceCancelled);

    const offReconnect = onReconnect(() => {
      joinStationRoom(organizationId, station);
      void loadTickets();
    });

    return () => {
      socket.off('order:new', handleNewOrder);
      socket.off('order:modified', handleOrderModified);
      socket.off('order:cancelled', handleOrderCancelled);
      socket.off('order:closed', handleOrderClosed);
      socket.off('order:claimed', handleOrderClaimed);
      socket.off('ticket:unclaimed', handleTicketUnclaimed);
      socket.off('order:force_cancelled', handleForceCancelled);
      offReconnect();
    };
  }, [
    accessToken,
    loadTickets,
    organizationId,
    removeOrderTickets,
    station,
    updateTicketRealTime,
  ]);

  return { pendingTickets, inProgressTickets, readyTickets, isLoading, error, station, reload: loadTickets };
}
