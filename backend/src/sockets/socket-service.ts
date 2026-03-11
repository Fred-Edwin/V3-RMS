import type { PrepStation } from '@prisma/client';
import type { PrepTicketRecord } from '../types/order.types';
import { branchRoomName, getSocketServer, stationRoomName, userRoomName } from './socket';

export interface OrderClaimedPayload {
  orderId: string;
  ticketId: string;
  station: PrepStation;
  dailyNumber: number;
  claimedBy: {
    id: string;
    name: string;
  };
}

export interface OrderReadyPayload {
  orderId: string;
  ticketId: string;
  station: PrepStation;
  dailyNumber: number;
}

export interface OrderAllReadyPayload {
  orderId: string;
  dailyNumber: number;
}

export interface OrderPaidPayload {
  orderId: string;
  dailyNumber: number;
}

export interface OrderClosedPayload {
  orderId: string;
  dailyNumber: number;
}

const emitToStations = (
  organizationId: string,
  stations: PrepStation[],
  eventName: string,
  payload: unknown,
): void => {
  const io = getSocketServer();
  const uniqueStations = [...new Set(stations)];

  uniqueStations.forEach((station) => {
    io.to(stationRoomName(organizationId, station)).emit(eventName, payload);
  });
};

export const socketService = {
  emitNewOrder: (organizationId: string, tickets: PrepTicketRecord[]): void => {
    const io = getSocketServer();
    tickets.forEach((ticket) => {
      io.to(stationRoomName(organizationId, ticket.station)).emit('order:new', ticket);
    });
  },

  emitOrderClaimed: (waiterId: string, payload: OrderClaimedPayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:claimed', payload);
  },

  emitOrderReady: (waiterId: string, payload: OrderReadyPayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:ready', payload);
  },

  emitOrderAllReady: (waiterId: string, payload: OrderAllReadyPayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:all_ready', payload);
  },

  emitOrderPaid: (waiterId: string, payload: OrderPaidPayload): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:paid', payload);
  },

  emitOrderClosed: (organizationId: string, stations: PrepStation[], payload: OrderClosedPayload): void => {
    emitToStations(organizationId, stations, 'order:closed', payload);
  },

  emitOrderModified: (organizationId: string, tickets: PrepTicketRecord[]): void => {
    const io = getSocketServer();
    tickets.forEach((ticket) => {
      io.to(stationRoomName(organizationId, ticket.station)).emit('order:modified', ticket);
    });
  },

  emitOrderCancelled: (organizationId: string, stations: PrepStation[], payload: { orderId: string }): void => {
    emitToStations(organizationId, stations, 'order:cancelled', payload);
  },

  emitOrderForceCancelled: (
    organizationId: string,
    stations: PrepStation[],
    waiterId: string,
    payload: { orderId: string; dailyNumber: number; cancelledBy: string },
  ): void => {
    emitToStations(organizationId, stations, 'order:force_cancelled', payload);
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('order:force_cancelled', payload);
  },

  emitTicketRejected: (
    organizationId: string,
    waiterId: string,
    payload: { orderId: string; ticketId: string; station: PrepStation; dailyNumber: number; reason: string },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('ticket:rejected', payload);
    io.to(stationRoomName(organizationId, payload.station)).emit('ticket:rejected', payload);
  },

  emitTicketUnclaimed: (
    waiterId: string,
    payload: { orderId: string; ticketId: string; station: PrepStation; dailyNumber: number },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('ticket:unclaimed', payload);
  },

  emitModificationRequested: (
    organizationId: string,
    stations: PrepStation[],
    payload: { requestId: string; orderId: string; dailyNumber: number; description: string; requestedBy: { id: string; name: string } },
  ): void => {
    emitToStations(organizationId, stations, 'modification:requested', payload);
  },

  emitModificationReviewed: (
    waiterId: string,
    payload: { requestId: string; orderId: string; status: string; reviewNote: string | null },
  ): void => {
    const io = getSocketServer();
    io.to(userRoomName(waiterId)).emit('modification:reviewed', payload);
  },

  emitIncident: (organizationId: string, payload: unknown): void => {
    const io = getSocketServer();
    io.to(branchRoomName(organizationId)).emit('incident:new', payload);
  },
};
