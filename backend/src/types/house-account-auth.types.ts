import type { HouseAccountAuthStatus } from '@prisma/client';

export interface HouseAccountAuthRequestRecord {
  id: string;
  organizationId: string;
  orderId: string;
  houseAccountId: string;
  requestedById: string;
  amount: string;
  status: HouseAccountAuthStatus;
  bullmqJobId: string | null;
  expiresAt: Date;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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

export type AuthDecision = 'APPROVED' | 'REJECTED';
