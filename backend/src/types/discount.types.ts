import type { CustomerDiscountAuthStatus, DiscountType } from '@prisma/client';

export interface DiscountRecord {
  id: string;
  organizationId: string | null;
  name: string;
  type: DiscountType;
  value: string;
  requiresApproval: boolean;
  isActive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: string; name: string };
}

export interface CustomerDiscountAuthRequestRecord {
  id: string;
  organizationId: string;
  orderId: string;
  discountId: string;
  requestedById: string;
  discountPercent: string | null;
  discountFixed: string | null;
  originalAmount: string;
  discountAmount: string;
  status: CustomerDiscountAuthStatus;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  order: { id: string; dailyNumber: number; total: string };
  discount: { id: string; name: string; type: DiscountType; value: string };
  requestedBy: { id: string; name: string };
  resolvedBy: { id: string; name: string } | null;
}

export type CustomerDiscountDecision = 'APPROVED' | 'REJECTED';
