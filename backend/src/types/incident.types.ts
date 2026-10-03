import type { IncidentType } from '@prisma/client';

export interface IncidentLogRecord {
  id: string;
  siteId: string;
  branchName: string;
  orderId: string | null;
  type: IncidentType;
  actor: { id: string; name: string } | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface CreateIncidentDto {
  siteId: string;
  orderId?: string;
  type: IncidentType;
  actorId?: string;
  details: Record<string, unknown>;
}
