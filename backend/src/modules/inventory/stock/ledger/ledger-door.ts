import { Prisma, type InventoryTransaction, type InventoryTransactionType } from '@prisma/client';
import { ConflictError, ValidationError } from '../../../../utils/errors';
import { referenceCounterRepository } from '../../_shared/reference-counter';
import { ledgerRepository } from './ledger-repository';
import { LEDGER_LINKS, LEDGER_RULES, reversedPrepQuantity, signedQuantity, type LedgerLink } from './ledger-rules';

type TxClient = Prisma.TransactionClient;

export type PostStockMovementInput = {
  type: InventoryTransactionType;
  locationId: string;
  inventoryItemId: string;
  /**
   * Always positive, except ADJUSTMENT, where the caller's sign is kept (a count can go either way).
   * The door negates OUT types (WASTE, PREP_CONSUME, DISPATCH_OUT), so callers never negate.
   */
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  reason?: string | null;
  userId: string;
  /** Exactly one source link, and it must be one the movement type allows (ledger-rules.ts). */
  links: Partial<Record<LedgerLink, string>>;
  /**
   * Set to undo an earlier row: this row then undoes it. A row can be reversed once. Two kinds:
   *  - ADJUSTMENT: send the exact opposite signed quantity.
   *  - PREP_CONSUME / PREP_PRODUCE: keep the original's type and send the same positive quantity; the door flips the sign
   *    (a reversed consume is a positive row, a reversed produce a negative one).
   *  - WASTE: the same rule (a reversed waste row is positive and returns the stock).
   */
  reversesTransactionId?: string;
};

/**
 * THE way to post a stock movement. Appends one row to the ledger (`inventory_transactions`) inside
 * the caller's transaction; it never opens one, so the row rolls back with the caller's work.
 *
 * Rules (each checked against the pre-door writers, 4 Oct 2026):
 *  - Append-only: this creates rows. A correction is a new row linked by `reversesTransactionId`.
 *  - Sign comes from the type (ledger-rules.ts), so a caller cannot forget to negate.
 *  - `siteId` is derived from the location's owning site, never passed in (waste-service.ts,
 *    dispatch-service.ts and discrepancy-service.ts all used the location's site). Central Store
 *    rows must sit on the hub site and branch department rows on a non-hub site (D-15).
 *  - Exactly one source link, valid for the type, and the linked document belongs to that site.
 *  - ADJUSTMENT rows get their ADJ-#### reference from the ReferenceCounter in the same transaction.
 */
export const postStockMovement = async (tx: TxClient, input: PostStockMovementInput): Promise<InventoryTransaction> => {
  const rule = LEDGER_RULES[input.type];
  if (!rule) throw new ValidationError(`Stock movements of type ${input.type} cannot be posted yet`);

  if (!input.quantity.isFinite() || input.quantity.isZero()) throw new ValidationError('A stock movement needs a quantity above zero');
  if (rule.direction !== 'SIGNED' && input.quantity.isNegative()) {
    throw new ValidationError('Enter the quantity as a positive number; the ledger applies the direction');
  }
  if (!input.unitCost.isFinite() || input.unitCost.isNegative()) throw new ValidationError('The unit cost cannot be negative');

  const setLinks = LEDGER_LINKS.filter((link) => input.links[link] !== undefined);
  const [link] = setLinks;
  if (setLinks.length !== 1 || link === undefined || !rule.links.includes(link)) {
    throw new ValidationError(`A ${input.type} movement must point at exactly one of: ${rule.links.join(', ')}`);
  }
  const linkId = input.links[link]!;

  const location = await ledgerRepository.findLocationOwner(tx, input.locationId);
  if (!location) throw new ValidationError('The stock location does not exist');
  if (location.type === 'CENTRAL_STORE' && !location.siteIsHub) {
    throw new ValidationError('Central Store stock belongs to the hub site');
  }
  if (location.type === 'BRANCH_DEPARTMENT' && location.siteIsHub) {
    throw new ValidationError('Branch department stock cannot sit on the hub site');
  }

  const linkOwners = await ledgerRepository.findLinkOwnerSites(tx, link, linkId);
  if (!linkOwners) throw new ValidationError('The document this movement points at does not exist');
  if (!linkOwners.includes(location.siteId)) throw new ValidationError('The document this movement points at belongs to another site');

  // The quantity that will be stored. Normally the type's own sign; a reversal of a prep row flips it.
  let storedQuantity = signedQuantity(rule.direction, input.quantity);

  if (input.reversesTransactionId !== undefined) {
    if (!rule.reversal) throw new ValidationError('Only an adjustment, a prep row or a waste row can reverse an earlier entry');
    const original = await ledgerRepository.findForReversal(tx, input.reversesTransactionId);
    if (!original) throw new ValidationError('The entry being reversed does not exist');
    if (rule.reversal === 'ADJUSTMENT' && original.type !== 'ADJUSTMENT') {
      throw new ValidationError('Only an adjustment can be reversed');
    }
    if (rule.reversal === 'PREP' || rule.reversal === 'WASTE' || rule.reversal === 'DISPATCH') {
      // A prep, waste or dispatch-out row is reversed by a row of its own type with the opposite sign; a reversal is never reversed again.
      const label = rule.reversal === 'PREP' ? 'prep' : rule.reversal === 'WASTE' ? 'waste' : 'dispatch';
      if (original.type !== input.type) throw new ValidationError(`A ${label} row can only be reversed by a row of the same type`);
      if (original.reversesTransactionId !== null) throw new ValidationError('A reversal cannot be reversed');
      storedQuantity = reversedPrepQuantity(rule.direction, input.quantity);
    }
    if (
      original.siteId !== location.siteId ||
      original.locationId !== input.locationId ||
      original.inventoryItemId !== input.inventoryItemId
    ) {
      throw new ValidationError('A reversal must match the original entry (same site, location and item)');
    }
    const expected = rule.reversal === 'ADJUSTMENT' ? input.quantity : storedQuantity;
    if (!expected.equals(original.quantity.negated())) {
      throw new ValidationError('A reversal must undo the original quantity exactly');
    }
    if (original.alreadyReversed) throw new ConflictError('This entry has already been reversed');
  }

  const reference = rule.numbered ? await referenceCounterRepository.nextReference(tx, location.siteId, 'ADJ') : null;

  try {
    return await ledgerRepository.create(tx, {
      siteId: location.siteId,
      locationId: input.locationId,
      inventoryItemId: input.inventoryItemId,
      type: input.type,
      quantity: storedQuantity,
      unitCost: input.unitCost,
      reason: input.reason ?? null,
      reference,
      reversesTransactionId: input.reversesTransactionId ?? null,
      userId: input.userId,
      links: { [link]: linkId },
    });
  } catch (error) {
    // Two reversals racing past the check above: the unique index on reverses_transaction_id decides.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && input.reversesTransactionId !== undefined) {
      throw new ConflictError('This entry has already been reversed');
    }
    throw error;
  }
};
