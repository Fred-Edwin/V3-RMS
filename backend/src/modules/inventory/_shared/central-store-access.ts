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
 *   - the Store Attendant sees item costs and prices but not stock figures or financial data (6 Oct 2026); department
 *     heads keep a narrow access and hold nothing from this table.
 *
 * Changing a rule after client feedback means editing `ROLE_CAPABILITIES` below, nothing else. The front end reads the
 * same table from `GET /inventory/permissions/me`, so there is no second copy to drift.
 *
 * Department heads are a marker on a base role, not a role; their restock access is decided by `isDepartmentHead` in the
 * restock routes and service, and they receive no capability from this table.
 */
export const CAPABILITIES = [
  // Catalog
  'catalog.read', // items and categories (a caller without `restock.read` gets the item with no stock figures: _shared/blind-rule.ts)
  'catalog.see_costs', // costs and prices on items (the Store Attendant holds it: owner decision 6 Oct 2026)
  'catalog.read_history', // an item's change history, which carries restock settings, so it follows stock figures, not costs
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
  // Prep (docs/features/inventory/prep-plan.md §2). The Store Manager and System Admin hold all seven via the filter above.
  'prep.read', // Runs, Usual recipes (read-only), History, run detail
  'prep.see_costs', // run costs: output unit cost, input and line costs, prep value (the Attendant is blind to them)
  'prep.read_flags', // flags, Needs a look, review status, expected stock on a run, History export (never the Attendant)
  'prep.record', // record a run; correct or cancel your OWN run within 24 hours (a service rule)
  'prep.fix_any', // correct or cancel any run, any age
  'prep.review', // Mark reviewed
  'prep.recipes_write', // set and edit usual recipes
  // Stock, Counting and Waste (docs/features/inventory/stock-count-waste-contract.md §3). The client has not approved these
  // mappings; each is a one-row edit below. The Store Attendant holds none of the `*.read` rows except `waste.read`, which the
  // waste service narrows to their own entries.
  'stock.read', // Overview, All items, Stock ledger, Stock card (positions, costs follow `catalog.see_costs`)
  'counts.read', // every count with expected stock, differences and the Director's flagged lines
  'counts.record', // start a count, count, sign it with the caller's PIN, recount; the Attendant's reorder for today and item moves
  'counts.resolve', // decide lines, approve and sign a submitted count with a PIN, ask for a recount
  'counts.setup', // sections, order, items, undo a move, the within-range settings
  'counts.acknowledge', // "Mark seen" on a flagged line (Director)
  'counts.set_director_alert', // the Director alert amount
  'waste.read', // every waste entry (the Attendant: their own only)
  'waste.log', // log waste at the Central Store
  'waste.reverse_own', // reverse an entry the caller logged earlier the same day
  'waste.reverse_any', // reverse any entry
  // Requisitions and Departments (docs/features/inventory/requisitions-contract.md §3). The client has not approved these
  // mappings; each is a one-row edit below. Heads and members hold none: their rights come from the department rule in the service.
  'requisitions.read', // open every requisition list and file (money follows `requisitions.see_value`; the Attendant sees no money)
  'requisitions.see_value', // value per line, department and total
  'requisitions.start', // start a requisition for the cycle; edit any section's lines ("Fill it myself")
  'requisitions.change_quantity', // change an Approved quantity, with a reason after approval
  'requisitions.approve', // approve and sign a requisition or an addition (own PIN)
  'requisitions.cancel', // cancel before approval, with a reason and a PIN
  'requisitions.nudge', // nudge a department; send without a section
  'requisitions.set_urgent', // set or clear Urgent before approval
  // Amendment 2 ("Fill it myself", Paper): the Branch Manager opens, edits and sends a Not started or Draft section for a department, with their own PIN.
  'requisitions.edit_on_behalf', // open and edit a department's section that is Not started or Draft (Branch Manager only)
  'requisitions.send_on_behalf', // send that section with the caller's own PIN; recorded as sent by the caller for that department (Branch Manager only)
  'departments.read', // Departments settings, read only
  'departments.write', // add, rename, retire, restore (own branch)
  'branches.set_code', // correct a branch's three-letter code, which numbers its requisitions (System Admin only; no screen in Block 1)
  // Audit log
  'audit.read',
  // Where the person may stand when reading: any organization (the hub rule D-15 still holds for every write)
  'central_store.read_any_org',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const READ_EVERYTHING: readonly Capability[] = [
  'catalog.read',
  'catalog.see_costs',
  'catalog.read_history',
  'restock.read',
  'suppliers.read_basic',
  'suppliers.read',
  'payables.read',
  'orders.read',
  'prep.read',
  'prep.see_costs',
  'prep.read_flags',
  'stock.read',
  'counts.read',
  'waste.read',
  'requisitions.read',
  'requisitions.see_value',
  'departments.read',
  'audit.read',
  'central_store.read_any_org',
];

/** Capabilities that belong to one named job, so the Store Manager does not inherit them from "everything". */
const NOT_THE_STORE_MANAGERS: readonly Capability[] = [
  'central_store.read_any_org',
  'counts.acknowledge',
  'counts.set_director_alert',
  // The branch's requisition and department jobs belong to the Branch Manager (the System Admin does them with their own PIN).
  'requisitions.start',
  'requisitions.change_quantity',
  'requisitions.approve',
  'requisitions.cancel',
  'requisitions.nudge',
  'requisitions.set_urgent',
  'requisitions.edit_on_behalf',
  'requisitions.send_on_behalf',
  'departments.write',
  'branches.set_code',
];

export const ROLE_CAPABILITIES: Partial<Record<UserRole, readonly Capability[]>> = {
  STORE_MANAGER: CAPABILITIES.filter((c) => !NOT_THE_STORE_MANAGERS.includes(c)),
  // Everything except "on behalf": filling and sending a department's section is the Branch Manager's alone (owner, 8 Oct 2026).
  SYSTEM_ADMIN: CAPABILITIES.filter((c) => c !== 'requisitions.edit_on_behalf' && c !== 'requisitions.send_on_behalf'),
  ACCOUNTANT: [
    ...READ_EVERYTHING,
    'suppliers.read_payment_details',
    'suppliers.write_payment_methods',
    'suppliers.upload_documents',
    'payables.record_invoice',
    'payables.record_payment',
    'payables.record_deposit',
  ],
  // The Director's only writes in Counting: "Mark seen" and the alert amount; in Requisitions, approving any requisition or addition.
  DIRECTOR: [...READ_EVERYTHING, 'suppliers.read_payment_details', 'counts.acknowledge', 'counts.set_director_alert', 'requisitions.approve'],
  // The Branch Manager reads everything except supplier payment details, and runs the branch's requisitions and departments.
  MANAGER: [
    ...READ_EVERYTHING,
    'requisitions.start',
    'requisitions.change_quantity',
    'requisitions.approve',
    'requisitions.cancel',
    'requisitions.nudge',
    'requisitions.set_urgent',
    'requisitions.edit_on_behalf',
    'requisitions.send_on_behalf',
    'departments.write',
  ],
  // Phone and desktop. Sees item costs and prices; blind to stock figures and to financial data (what we owe, invoices,
  // payments, supplier balances and payment details, reports): see `_shared/blind-rule.ts`. Raises order requests and
  // receives deliveries.
  STORE_ATTENDANT: [
    'catalog.read',
    'catalog.see_costs',
    'catalog.add_missing',
    'suppliers.read_basic',
    'suppliers.quick_add',
    'orders.read',
    'orders.request',
    'orders.receive',
    'prep.read',
    'prep.record',
    // Counts blind (own count only), logs waste, reads and reverses their own waste the same day.
    'counts.record',
    'waste.read',
    'waste.log',
    'waste.reverse_own',
    // Reads every requisition to pack it; no money and no branch values (the `requisitions.see_value` row is not theirs).
    'requisitions.read',
  ],
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
