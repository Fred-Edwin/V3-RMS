import type { ModificationRequestStatus } from '@prisma/client';

export interface ModificationRequestRecord {
  id: string;
  siteId: string;
  orderId: string;
  requestedBy: { id: string; name: string };
  description: string;
  status: ModificationRequestStatus;
  reviewedBy: { id: string; name: string } | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}
