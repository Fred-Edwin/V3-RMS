import type { CancellationRequestStatus, OrderStatus } from '@prisma/client';

export type OrderCancellationDecision = Exclude<CancellationRequestStatus, 'PENDING'>;

export interface OrderCancellationAuthRequestRecord {
  id: string;
  organizationId: string;
  orderId: string;
  requestedById: string;
  reason: string;
  reasonDetail: string | null;
  previousStatus: OrderStatus;
  status: CancellationRequestStatus;
  resolvedById: string | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  order: {
    id: string;
    dailyNumber: number;
    status: OrderStatus;
    total: string;
  };
  requestedBy: {
    id: string;
    name: string;
  };
  resolvedBy: {
    id: string;
    name: string;
  } | null;
}
