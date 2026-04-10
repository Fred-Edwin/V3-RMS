export type StaffDiscountAuthStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type StaffDiscountDecision = 'APPROVED' | 'REJECTED';

export interface StaffDiscountAuthRequest {
  id: string;
  organizationId: string;
  orderId: string;
  requestedById: string;
  discountPercent: string;
  originalAmount: string;
  discountAmount: string;
  status: StaffDiscountAuthStatus;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  order: { id: string; dailyNumber: number; total: string };
  requestedBy: { id: string; name: string };
  resolvedBy: { id: string; name: string } | null;
}
