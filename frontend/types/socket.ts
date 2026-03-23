import type { PrepStation, PrepTicketDetail } from './order';
import type { StocktakeVariancePayload } from './inventory';

export interface ServerToClientEvents {
  'joined:branch': (payload: { room: string }) => void;
  'error:join:branch': (payload: { message: string }) => void;
  'joined:station': (payload: { room: string; station: PrepStation }) => void;
  'error:join:station': (payload: { message: string }) => void;
  'joined:user': (payload: { room: string }) => void;
  'error:join:user': (payload: { message: string }) => void;
  'order:new': (payload: PrepTicketDetail) => void;
  'order:claimed': (payload: {
    orderId: string;
    ticketId: string;
    station: PrepStation;
    dailyNumber: number;
    claimedBy: { id: string; name: string };
  }) => void;
  'order:ready': (payload: {
    orderId: string;
    ticketId: string;
    station: PrepStation;
    dailyNumber: number;
  }) => void;
  'order:all_ready': (payload: { orderId: string; dailyNumber: number }) => void;
  'order:paid': (payload: { orderId: string; dailyNumber: number }) => void;
  'order:modified': (payload: PrepTicketDetail) => void;
  'order:cancelled': (payload: { orderId: string }) => void;
  'order:closed': (payload: { orderId: string }) => void;
  'order:force_cancelled': (payload: { orderId: string }) => void;
  'ticket:rejected': (payload: {
    orderId: string;
    ticketId: string;
    station: PrepStation;
    reason: string;
  }) => void;
  'ticket:unclaimed': (payload: {
    orderId: string;
    ticketId: string;
    station: PrepStation;
  }) => void;
  'incident:new': (payload: {
    id: string;
    type: string;
    orderId?: string;
    actor: { id: string; name: string };
    details: Record<string, unknown>;
    createdAt: string;
  }) => void;
  'inventory:low_stock': (payload: { organizationId: string; menuItemId: string; currentQty: number }) => void;
  'inventory:out_of_stock': (payload: { organizationId: string; menuItemId: string }) => void;
  'inventory:stocktake_variance': (payload: StocktakeVariancePayload) => void;
}

export interface ClientToServerEvents {
  'join:branch': (payload: { organizationId: string }) => void;
  'join:station': (payload: { organizationId: string; station: PrepStation }) => void;
  'join:user': (payload: { userId: string }) => void;
}
