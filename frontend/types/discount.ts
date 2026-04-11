export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type CustomerDiscountAuthStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Discount {
  id: string;
  organizationId: string | null;
  name: string;
  type: DiscountType;
  value: string;
  requiresApproval: boolean;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
}

export interface CustomerDiscountAuthRequest {
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
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  order: { id: string; dailyNumber: number; total: string };
  discount: { id: string; name: string; type: DiscountType; value: string };
  requestedBy: { id: string; name: string };
  resolvedBy: { id: string; name: string } | null;
}

export interface CreateDiscountInput {
  organizationId: string | null;
  name: string;
  type: DiscountType;
  value: number;
  requiresApproval: boolean;
}

export interface UpdateDiscountInput {
  organizationId?: string | null;
  name?: string;
  type?: DiscountType;
  value?: number;
  requiresApproval?: boolean;
  isActive?: boolean;
}
