import type { OrderStatus } from './order';

export type OrderCancellationAuthStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type OrderCancellationDecision = 'APPROVED' | 'REJECTED';

export interface OrderCancellationAuthRequest {
  id: string;
  organizationId: string;
  orderId: string;
  requestedById: string;
  reason: string;
  reasonDetail: string | null;
  previousStatus: OrderStatus;
  status: OrderCancellationAuthStatus;
  resolvedById: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  order: { id: string; dailyNumber: number; status: OrderStatus; total: string };
  requestedBy: { id: string; name: string };
  resolvedBy: { id: string; name: string } | null;
}
