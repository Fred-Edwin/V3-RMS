import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@prisma/client';
import { branchRepository } from '../../../repositories/branch-repository';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../../utils/errors';

/**
 * Who may do what in the Central Store: the one table every guard reads (decisions.md, "Access").
 *
 * The client has not approved the role names or the role-to-screen mapping drawn in Paper, so access is set here,
 * not by the design's chapter labels. The rule agreed with the owner (3 Oct 2026):
 *   - the desktop roles (Store Manager, Accountant, Director, Branch Manager, System Admin) can READ every Central Store screen;
 *   - WRITE belongs to whoever does that job;
 *   - supplier payment details are hidden from the Branch Manager;
 *   - the Store Attendant and department heads keep a narrow, phone-first access, blind to money.
 *
 * Changing a rule after client feedback means editing `ROLE_CAPABILITIES` below, nothing else. The front end reads the
 * same table from `GET /inventory/permissions/me`, so there is no second copy to drift.
 *
 * Department heads are a marker on a base role, not a role; their restock access is decided by `isDepartmentHead` in the
 * restock routes and service, and they receive no capability from this table.
 */
export const CAPABILITIES = [
  // Catalog
  'catalog.read', // items, categories, item history (an attendant gets the stripped, price-free view)
  'catalog.see_costs', // costs and prices on items
  'catalog.write', // create, edit, retire, restore items; manage categories
  'catalog.add_missing', // the attendant's short "add a missing item" form
  // Restock levels
  'restock.read',
  'restock.write', // the Central Store's levels, and any branch department's, and Put back
  // Suppliers
  'suppliers.read_basic', // the stripped supplier list an attendant picks from
  'suppliers.read', // list, page, contacts, catalog lines, documents, summaries
  'suppliers.read_payment_details', // the Payment tab: methods, account numbers, change history
  'suppliers.write', // profile, contacts, catalog lines, preferred, put on hold / archive, delete a document
  'suppliers.write_payment_methods',
  'suppliers.upload_documents',
  'suppliers.quick_add',
  // What we owe
  'payables.read',
  'payables.record_invoice',
  'payables.record_payment', // payments, reversals, invoice adjustments
  'payables.record_deposit', // an advance against an approved order, before any invoice exists
  // Purchasing and Receiving (orders). The client has not approved these mappings; each is a one-row edit below.
  'orders.read', // open every Purchasing screen (write buttons stay hidden without the matching capability below)
  'orders.request', // save a draft and send it for approval
  'orders.approve', // approve with a PIN, return with a note, send the approved order
  'orders.cancel', // cancel an order before anything arrives
  'orders.receive', // record a delivery
  // Audit log
  'audit.read',
  // Where the person may stand when reading: any organization (the hub rule D-15 still holds for every write)
  'central_store.read_any_org',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const READ_EVERYTHING: readonly Capability[] = [
  'catalog.read',
  'catalog.see_costs',
  'restock.read',
  'suppliers.read_basic',
  'suppliers.read',
  'payables.read',
  'orders.read',
  'audit.read',
  'central_store.read_any_org',
];

export const ROLE_CAPABILITIES: Partial<Record<UserRole, readonly Capability[]>> = {
  STORE_MANAGER: CAPABILITIES.filter((c) => c !== 'central_store.read_any_org'),
  SYSTEM_ADMIN: CAPABILITIES,
  ACCOUNTANT: [
    ...READ_EVERYTHING,
    'suppliers.read_payment_details',
    'suppliers.write_payment_methods',
    'suppliers.upload_documents',
    'payables.record_invoice',
    'payables.record_payment',
    'payables.record_deposit',
  ],
  DIRECTOR: [...READ_EVERYTHING, 'suppliers.read_payment_details'],
  // The Branch Manager reads everything except supplier payment details.
  MANAGER: READ_EVERYTHING,
  // Narrow and phone-first; sees no money. Raises order requests and receives deliveries.
  STORE_ATTENDANT: ['catalog.read', 'catalog.add_missing', 'suppliers.read_basic', 'suppliers.quick_add', 'orders.request', 'orders.receive'],
};

type Actor = NonNullable<Request['user']>;

export const roleCan = (role: UserRole | string | null | undefined, capability: Capability): boolean =>
  ((ROLE_CAPABILITIES[role as UserRole] ?? []) as readonly Capability[]).includes(capability);

export const actorCan = (actor: Pick<Actor, 'role'>, capability: Capability): boolean => roleCan(actor.role, capability);

/** Every capability a role holds (department heads hold none here; see the note above). */
export const capabilitiesOf = (role: UserRole | string | null | undefined): Capability[] => [...((ROLE_CAPABILITIES[role as UserRole] ?? []) as readonly Capability[])];

/** Route guard: the caller needs at least one of these capabilities. */
export const requireCapability = (...capabilities: Capability[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError('Authentication required');
    if (!capabilities.some((c) => actorCan(req.user as Actor, c))) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
    next();
  };
};

const findHubId = async (): Promise<string> => {
  const hub = await branchRepository.findHub();
  if (!hub) throw new ValidationError('No hub organization is configured');
  return hub.id;
};

/**
 * D-15 for writes (and for reads that have not been opened up): Central Store data belongs to the hub organization.
 * A hub user passes. So does the System Admin, who has no organization and may write to everything.
 * Anyone else is refused, however their role reads.
 */
export const requireHubActor = async (actor: Actor): Promise<string> => {
  const hubId = await findHubId();
  if (actor.role === 'SYSTEM_ADMIN' || actor.siteId === hubId) return hubId;
  throw new ForbiddenError('Only the hub organization may access Central Store inventory data');
};

/**
 * The read-only exception to D-15: a role holding `central_store.read_any_org` (Branch Manager, and the desktop roles in
 * case they sit elsewhere) reads the hub's data from wherever it stands. It still resolves to the hub's id, never to the
 * actor's own organization, and it is only used by read paths; writes keep `requireHubActor`.
 */
export const requireHubReader = async (actor: Actor): Promise<string> => {
  const hubId = await findHubId();
  if (actor.siteId === hubId || actorCan(actor, 'central_store.read_any_org')) return hubId;
  throw new ForbiddenError('Only the hub organization may access Central Store inventory data');
};
