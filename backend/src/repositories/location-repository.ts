import type { DepartmentTag, Location, LocationType } from '@prisma/client';
import { prisma } from '../config/database';

/**
 * Location access. Phase 1 has exactly one row system-wide (type
 * CENTRAL_STORE, owned by the hub organization — design doc D-15), created
 * once through createCentralStore below. Phase 2 adds BRANCH_DEPARTMENT rows;
 * this repository will grow filters (e.g. by department) then, not before.
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

  // Deliberately unscoped: the single-Central-Store invariant is system-wide,
  // so existence checks must look across all organizations (the partial
  // unique index in migration 20260731090000 is the DB-level backstop).
  findCentralStore: async (): Promise<Location | null> => {
    return prisma.location.findFirst({ where: { type: 'CENTRAL_STORE' } });
  },

  createCentralStore: async (organizationId: string, name: string): Promise<Location> => {
    return prisma.location.create({
      data: { organizationId, type: 'CENTRAL_STORE', name },
    });
  },

  /** Phase 2: the single BRANCH_DEPARTMENT location for a (branch org, department). */
  findByOrganizationTypeDepartment: async (
    organizationId: string,
    type: LocationType,
    departmentTag: DepartmentTag,
  ): Promise<Location | null> => {
    return prisma.location.findFirst({ where: { organizationId, type, departmentTag } });
  },
};
