import { incidentRepository } from '../repositories/incident-repository';
import type { CreateIncidentDto, IncidentLogRecord } from '../types/incident.types';
import type { IncidentQueryInput } from '../validators/incident-schemas';
import { logger } from '../utils/logger';

const serialize = (incident: {
  id: string;
  organizationId: string;
  orderId: string | null;
  type: string;
  actorId: string | null;
  details: unknown;
  createdAt: Date;
  actor: { id: string; name: string } | null;
  organization: { id: string; name: string };
}): IncidentLogRecord => ({
  id: incident.id,
  organizationId: incident.organizationId,
  branchName: incident.organization.name,
  orderId: incident.orderId,
  type: incident.type as IncidentLogRecord['type'],
  actor: incident.actor ? { id: incident.actor.id, name: incident.actor.name } : null,
  details: (incident.details ?? {}) as Record<string, unknown>,
  createdAt: incident.createdAt.toISOString(),
});

export const incidentService = {
  log: (data: CreateIncidentDto): void => {
    incidentRepository.create(data).catch((error: unknown) => {
      logger.error({ error, data }, 'Failed to log incident');
    });
  },

  getMany: async (
    organizationId: string | null,
    query: IncidentQueryInput,
  ) => {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const { incidents, total } = await incidentRepository.findMany(organizationId, {
      type: query.type,
      startDate,
      endDate,
      orderId: query.orderId,
      branchId: query.branchId,
      page: query.page,
      perPage: query.perPage,
    });

    return {
      incidents: incidents.map(serialize),
      pagination: {
        total,
        page: query.page,
        perPage: query.perPage,
        totalPages: Math.ceil(total / query.perPage),
      },
    };
  },
};
