export type HouseAccountAuthStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'TIMED_OUT';
export type AuthDecision = 'APPROVED' | 'REJECTED';

export interface HouseAccountAuthRequest {
  id: string;
  organizationId: string;
  orderId: string;
  houseAccountId: string;
  requestedById: string;
  amount: string;
  status: HouseAccountAuthStatus;
  bullmqJobId: string | null;
  expiresAt: string;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    dailyNumber: number;
    total: string;
  };
  houseAccount: {
    id: string;
    user: { id: string; name: string };
  };
  requestedBy: { id: string; name: string };
  resolvedBy: { id: string; name: string } | null;
}
