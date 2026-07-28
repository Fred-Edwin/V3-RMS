import type { Location } from '@prisma/client';
import { prisma } from '../config/database';

/**
 * Location access — read-only for Phase 1. There is exactly one row per
 * organization (type CENTRAL_STORE), created by seed/ops, not through this
 * API (feature plan D-1 — Location is its own entity, never user-managed
 * like a branch). Phase 2 adds BRANCH_DEPARTMENT rows; this repository will
 * grow filters (e.g. by department) then, not before.
 */
export const locationRepository = {
  findAllByOrganization: async (organizationId: string): Promise<Location[]> => {
    return prisma.location.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  findById: async (id: string, organizationId: string): Promise<Location | null> => {
    return prisma.location.findFirst({ where: { id, organizationId } });
  },
};
