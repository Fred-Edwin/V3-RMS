import { useCallback, useEffect } from 'react';
import { connectSocket, getSocket, joinStationRoom, onReconnect } from '@/lib/socket';
import { prepTicketService } from '@/services/prepTicketService';
import { useAuthStore } from '@/store/authStore';
import { useKitchenStore } from '@/store/kitchenStore';
import type { PrepStation, PrepTicketStatus } from '@/types/order';

// Returns all stations this role can manage. Kitchen-family roles see KITCHEN,
// PIZZA, and PASTRY tickets on the same display.
const stationsFromRole = (role: string | null): PrepStation[] => {
  if (role === 'CHEF' || role === 'KITCHEN_DISPLAY') {
    return ['KITCHEN', 'PIZZA', 'PASTRY'];
  }
  if (role === 'BARISTA' || role === 'BARISTA_DISPLAY') {
    return ['BARISTA'];
  }
  return [];
};

export function usePrepTickets() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const organizationId = useAuthStore((state) => state.organizationId);
  const role = useAuthStore((state) => state.role);
  const stations = stationsFromRole(role);
  // Primary station used as a guard value by DisplayBoard (backward compat)
  const station = stations[0] ?? null;
  // Stable string for useCallback dependency — avoids new array reference on each render
  const stationsKey = stations.join(',');

  const pendingTickets = useKitchenStore((state) => state.pendingTickets);
  const inProgressTickets = useKitchenStore((state) => state.inProgressTickets);
  const readyTickets = useKitchenStore((state) => state.readyTickets);
  const isLoading = useKitchenStore((state) => state.isLoading);
  const error = useKitchenStore((state) => state.error);
  const setTickets = useKitchenStore((state) => state.setTickets);
  const updateTicketRealTime = useKitchenStore((state) => state.updateTicketRealTime);
  const removeOrderTickets = useKitchenStore((state) => state.removeOrderTickets);
  const setLoading = useKitchenStore((state) => state.setLoading);
  const setError = useKitchenStore((state) => state.setError);

  const loadTickets = useCallback(async () => {
    if (!accessToken || stations.length === 0) {
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
  // stationsKey is a stable string derived from the stations array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, setError, setLoading, setTickets, stationsKey]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (!accessToken || !organizationId || stations.length === 0) {
      return;
    }

    connectSocket(accessToken);
    // Join a socket room for every station this role manages
    stations.forEach((s) => joinStationRoom(organizationId, s));

    const socket = getSocket();
    if (!socket) {
      return;
    }

    const handleNewOrder = (ticket: { id: string; station: PrepStation }) => {
      if (!stations.includes(ticket.station)) {
        return;
      }
      void loadTickets();
    };

    const handleOrderModified = (ticket: { id: string; station: PrepStation; status: PrepTicketStatus }) => {
      if (!stations.includes(ticket.station)) {
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
      if (!stations.includes(payload.station)) return;
      updateTicketRealTime(payload.ticketId, { status: 'IN_PROGRESS' });
    };

    const handleTicketUnclaimed = (payload: { ticketId: string; station: PrepStation }) => {
      if (!stations.includes(payload.station)) return;
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
      stations.forEach((s) => joinStationRoom(organizationId, s));
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
  // stationsKey is a stable string derived from the stations array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accessToken,
    loadTickets,
    organizationId,
    removeOrderTickets,
    stationsKey,
    updateTicketRealTime,
  ]);

  return { pendingTickets, inProgressTickets, readyTickets, isLoading, error, station, reload: loadTickets };
}
