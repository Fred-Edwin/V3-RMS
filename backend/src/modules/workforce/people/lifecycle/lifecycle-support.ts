import { ForbiddenError, NotFoundError } from '../../../../utils/errors';
import { assertNotSelf, inScope, type Capability } from '../../_shared/workforce-access';
import { targetOf } from '../people-access';
import type { ActorCtx } from '../people-context';
import type { Doer } from './lifecycle-engine';
import { lifecycleRepository, type LifecycleEmployee } from './lifecycle-repository';

/** What the person at the keyboard is, as the engine and the audit entries want to see it. */
export const appDoer = (ctx: ActorCtx): Doer => ({ actor: ctx.auditActor, channel: 'APP' });

/**
 * Loads a file for a write. Someone who cannot even read it gets 404; someone who can read it but not do this gets 403.
 * Every lifecycle service starts here, so the scope rule is written once.
 */
export async function loadForWrite(ctx: ActorCtx, id: string, capability: Capability): Promise<LifecycleEmployee> {
  const emp = await lifecycleRepository.findEmployeeTop(ctx.companyId, id);
  if (!emp) throw new NotFoundError('Employee not found');
  const target = targetOf(emp);
  if (!inScope(ctx.subject, capability, target)) {
    if (!inScope(ctx.subject, 'employee.read_basic', target)) throw new NotFoundError('Employee not found');
    throw new ForbiddenError('You do not have permission to perform this action');
  }
  assertNotSelf(ctx.subject, target); // nobody exits, transfers or confirms themself
  return emp;
}
