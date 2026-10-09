import type { Request } from 'express';
import { branchRepository } from '../../../repositories/branch-repository';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../../utils/errors';
import { actorCan } from '../_shared/central-store-access';
import { dispatchRepository, type DispatchScope } from './dispatch-repository';

type Actor = NonNullable<Request['user']>;

/** Who is calling a Dispatch endpoint: the actor, their stored record, and the hub the dispatches belong to. */
export interface Caller {
  actor: Actor;
  staff: NonNullable<Awaited<ReturnType<typeof dispatchRepository.findStaff>>>;
  hubId: string;
}

export const loadCaller = async (actor: Actor): Promise<Caller> => {
  const staff = await dispatchRepository.findStaff(actor.id);
  if (!staff) throw new UnauthorizedError('Authentication required');
  const hub = await branchRepository.findHub();
  if (!hub) throw new ValidationError('No hub organization is configured');
  return { actor, staff, hubId: hub.id };
};

/**
 * `dispatch.read` is narrowed here (the access table only says who holds it): the Branch Manager reads their own branch, the
 * Attendant their own packing history, the other hub roles everything. A caller without the capability reads nothing.
 */
export const readScope = (c: Caller): DispatchScope => {
  if (!actorCan(c.actor, 'dispatch.read')) throw new ForbiddenError('You do not have permission to view dispatches');
  if (c.actor.role === 'MANAGER') {
    if (!c.staff.siteId) throw new ValidationError('Branch context missing for this user');
    return { hubId: c.hubId, toSiteId: c.staff.siteId };
  }
  if (c.actor.role === 'STORE_ATTENDANT') return { hubId: c.hubId, packedOrSignedBy: c.staff.id };
  return { hubId: c.hubId };
};

/** The branch side (the Branch Manager reading a dispatch) never sees the sent figure before the department has signed its count. */
export const isBranchSide = (c: Caller): boolean => c.actor.role === 'MANAGER';
