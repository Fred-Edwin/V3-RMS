import type { Request } from 'express';
import type { DepartmentTag, Location } from '@prisma/client';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../utils/errors';

type Actor = NonNullable<Request['user']>;

/**
 * Where a stock/waste request runs, resolved from the **actor**, never from
 * a client-supplied location (plan §2.1). Two org ids because the catalog is
 * on the hub org while a department's ledger rows live on its branch org
 * (D-15, CENTRAL_STORE_SCOPING_DESIGN.md §4).
 */
export type StockScope = {
  itemOrgId: string;
  locationOrgId: string;
  locationId: string;
  location: Location;
  /** Set for a branch department location — limits the item set to that department's tagged items. */
  departmentTag?: DepartmentTag;
  /** Branch org name for a department location; null at the Central Store. */
  branchName: string | null;
};

export const requireHubOrgId = async (): Promise<string> => {
  const hub = await branchRepository.findHub();
  if (!hub) throw new ValidationError('No hub organization is configured');
  return hub.id;
};

const centralStoreScope = async (actor: Actor): Promise<StockScope> => {
  const hubOrgId = await requireHubOrgId();
  if (actor.siteId !== hubOrgId) {
    throw new ForbiddenError('Only the hub organization may access Central Store inventory data');
  }
  const centralStore = await locationRepository.findCentralStore();
  if (!centralStore || centralStore.siteId !== hubOrgId) {
    throw new NotFoundError('No Central Store is configured for this organization');
  }
  return { itemOrgId: hubOrgId, locationOrgId: hubOrgId, locationId: centralStore.id, location: centralStore, branchName: null };
};

const departmentScope = async (siteId: string, location: Location): Promise<StockScope> => {
  const hubOrgId = await requireHubOrgId();
  const branch = await branchRepository.findById(siteId);
  return {
    itemOrgId: hubOrgId,
    locationOrgId: siteId,
    locationId: location.id,
    location,
    departmentTag: location.departmentTag ?? undefined,
    branchName: branch?.name ?? null,
  };
};

const ownDepartmentScope = async (actor: Actor): Promise<StockScope> => {
  if (!actor.siteId) throw new ValidationError('Branch context missing for this user');
  if (!actor.departmentTag) throw new ValidationError('This user has no department assigned');
  const location = await locationRepository.findBySiteTypeDepartment(
    actor.siteId,
    'BRANCH_DEPARTMENT',
    actor.departmentTag,
  );
  if (!location) throw new NotFoundError('No location found for your department');
  return departmentScope(actor.siteId, location);
};

/** Stock list / summary: the Central Store only. */
export const resolveCentralStoreScope = centralStoreScope;

/**
 * Waste: Store Manager / Store Attendant → the Central Store; department
 * head → their own department. Nobody else logs waste this milestone.
 */
export const resolveWasteScope = async (actor: Actor): Promise<StockScope> => {
  if (actor.isDepartmentHead) return ownDepartmentScope(actor);
  if (actor.role === 'STORE_MANAGER' || actor.role === 'STORE_ATTENDANT') return centralStoreScope(actor);
  throw new ForbiddenError('You may not log waste');
};

/**
 * Ledger (plan §2.1, §7 #7): Store Manager → Central Store; Branch Manager →
 * one of their own branch's department locations (required); department
 * head → their own department. The Store Attendant never reaches the ledger
 * (blind count) — the route already 403s; this is the second wall.
 */
export const resolveLedgerScope = async (actor: Actor, requestedLocationId: string | undefined): Promise<StockScope> => {
  if (actor.isDepartmentHead) {
    const scope = await ownDepartmentScope(actor);
    if (requestedLocationId && requestedLocationId !== scope.locationId) {
      throw new ForbiddenError('You may only view your own department’s ledger');
    }
    return scope;
  }

  if (actor.role === 'STORE_MANAGER') {
    const scope = await centralStoreScope(actor);
    if (requestedLocationId && requestedLocationId !== scope.locationId) {
      throw new ForbiddenError('The Store Manager’s ledger view is the Central Store only');
    }
    return scope;
  }

  if (actor.role === 'MANAGER') {
    if (!actor.siteId) throw new ValidationError('Branch context missing for this user');
    if (!requestedLocationId) throw new ValidationError('locationId is required');
    const location = await locationRepository.findById(requestedLocationId, actor.siteId);
    if (!location || location.type !== 'BRANCH_DEPARTMENT') {
      throw new ForbiddenError('You may only view your own branch’s department ledgers');
    }
    return departmentScope(actor.siteId, location);
  }

  throw new ForbiddenError('You may not view the stock ledger');
};
