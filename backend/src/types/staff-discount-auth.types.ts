import type { StaffDiscountAuthStatus } from '@prisma/client';

export interface StaffDiscountAuthRequestRecord {
  id: string;
  organizationId: string;
  orderId: string;
  requestedById: string;
  discountPercent: string;
  originalAmount: string;
  discountAmount: string;
  status: StaffDiscountAuthStatus;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  order: { id: string; dailyNumber: number; total: string };
  requestedBy: { id: string; name: string };
  resolvedBy: { id: string; name: string } | null;
}

export type StaffDiscountDecision = 'APPROVED' | 'REJECTED';

export const STAFF_DISCOUNT_PERCENT = 30;
