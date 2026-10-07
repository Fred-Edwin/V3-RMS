/**
 * The stock ledger door (Inventory step 1b): sign by type, one valid source link, site derived from
 * the location, hub rule, ADJ numbering, single reversal, and the caller's transaction.
 * Mocks the repository; the real-database proof is in ledger-door.db.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, type InventoryTransactionType } from '@prisma/client';
import { postStockMovement, type PostStockMovementInput } from './ledger-door';
import { ledgerRepository } from './ledger-repository';
import { referenceCounterRepository } from '../../_shared/reference-counter';
import { LEDGER_RULES, type LedgerLink } from './ledger-rules';
import { ConflictError, ValidationError } from '../../../../utils/errors';

vi.mock('./ledger-repository', () => ({
  ledgerRepository: {
    findLocationOwner: vi.fn(),
    findLinkOwnerSites: vi.fn(),
    findForReversal: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../_shared/reference-counter', () => ({
  referenceCounterRepository: { nextReference: vi.fn() },
}));

const D = (value: string | number) => new Prisma.Decimal(value);
const tx = { marker: 'caller-tx' } as unknown as Prisma.TransactionClient;

const hubSite = 'site-hub';
const branchSite = 'site-branch';
const storeLocation = { id: 'loc-store', siteId: hubSite, type: 'CENTRAL_STORE' as const, siteIsHub: true };
const kitchenLocation = { id: 'loc-kitchen', siteId: branchSite, type: 'BRANCH_DEPARTMENT' as const, siteIsHub: false };

/** One valid example per postable type: the link it needs and where it posts. */
const LINK_FOR: Record<string, LedgerLink> = {
  RECEIVE: 'purchaseDeliveryLineId',
  PREP_CONSUME: 'prepRecordId',
  PREP_PRODUCE: 'prepRecordId',
  WASTE: 'wasteLogId',
  DISPATCH_OUT: 'dispatchLineId',
  DISPATCH_IN: 'dispatchLineId',
  ADJUSTMENT: 'stockCountLineId',
};

const base = (overrides: Partial<PostStockMovementInput> = {}): PostStockMovementInput => ({
  type: 'WASTE',
  locationId: storeLocation.id,
  inventoryItemId: 'item-1',
  quantity: D(3),
  unitCost: D(90),
  userId: 'user-1',
  links: { wasteLogId: 'waste-1' },
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(ledgerRepository.findLocationOwner).mockResolvedValue(storeLocation);
  vi.mocked(ledgerRepository.findLinkOwnerSites).mockResolvedValue([hubSite]);
  vi.mocked(ledgerRepository.create).mockImplementation(async (_tx, input) => ({ id: 'row-1', ...input }) as never);
  vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('ADJ-0007');
});

const created = () => vi.mocked(ledgerRepository.create).mock.calls[0]![1];

describe('postStockMovement — sign, link, cost and reference per type', () => {
  const expectedSign: Record<string, 1 | -1> = {
    RECEIVE: 1,
    PREP_CONSUME: -1,
    PREP_PRODUCE: 1,
    WASTE: -1,
    DISPATCH_OUT: -1,
    DISPATCH_IN: 1,
  };

  for (const [type, sign] of Object.entries(expectedSign)) {
    it(`${type}: caller passes a positive quantity, the ledger stores it ${sign === 1 ? 'positive' : 'negative'}`, async () => {
      const link = LINK_FOR[type]!;
      await postStockMovement(tx, base({ type: type as InventoryTransactionType, links: { [link]: 'doc-1' }, reason: 'why' }));

      const row = created();
      expect(row.quantity.toString()).toBe(String(3 * sign));
      expect(row.type).toBe(type);
      expect(row.links).toEqual({ [link]: 'doc-1' });
      expect(row.unitCost.toString()).toBe('90');
      expect(row.reason).toBe('why');
      expect(row.siteId).toBe(hubSite);
      expect(row.reference).toBeNull();
      expect(referenceCounterRepository.nextReference).not.toHaveBeenCalled();
    });
  }

  it('ADJUSTMENT keeps the caller’s sign (both ways) and gets an ADJ reference from the location’s site', async () => {
    await postStockMovement(tx, base({ type: 'ADJUSTMENT', quantity: D('-2.5'), links: { stockCountLineId: 'cl-1' } }));
    expect(created().quantity.toString()).toBe('-2.5');
    expect(created().reference).toBe('ADJ-0007');
    expect(referenceCounterRepository.nextReference).toHaveBeenCalledWith(tx, hubSite, 'ADJ');

    vi.mocked(ledgerRepository.create).mockClear();
    await postStockMovement(tx, base({ type: 'ADJUSTMENT', quantity: D('4'), links: { stockCountLineId: 'cl-1' } }));
    expect(created().quantity.toString()).toBe('4');
  });

  it('ADJUSTMENT accepts each of its four source links', async () => {
    for (const link of LEDGER_RULES.ADJUSTMENT!.links) {
      await expect(postStockMovement(tx, base({ type: 'ADJUSTMENT', links: { [link]: 'doc-1' } }))).resolves.toBeDefined();
    }
  });

  it('derives siteId from the location, so a branch department posts on the branch site', async () => {
    vi.mocked(ledgerRepository.findLocationOwner).mockResolvedValue(kitchenLocation);
    vi.mocked(ledgerRepository.findLinkOwnerSites).mockResolvedValue([branchSite]);
    await postStockMovement(tx, base({ locationId: kitchenLocation.id }));
    expect(created().siteId).toBe(branchSite);
  });

  it('accepts a dispatch line from either side of the dispatch (hub out, branch in)', async () => {
    vi.mocked(ledgerRepository.findLocationOwner).mockResolvedValue(kitchenLocation);
    vi.mocked(ledgerRepository.findLinkOwnerSites).mockResolvedValue([hubSite, branchSite]);
    await postStockMovement(tx, base({ type: 'DISPATCH_IN', locationId: kitchenLocation.id, links: { dispatchLineId: 'dl-1' } }));
    expect(created().siteId).toBe(branchSite);
  });

  it('joins the caller’s transaction: every repository call receives the same tx', async () => {
    await postStockMovement(tx, base({ type: 'ADJUSTMENT', links: { stockCountLineId: 'cl-1' } }));
    expect(vi.mocked(ledgerRepository.findLocationOwner).mock.calls[0]![0]).toBe(tx);
    expect(vi.mocked(ledgerRepository.findLinkOwnerSites).mock.calls[0]![0]).toBe(tx);
    expect(vi.mocked(ledgerRepository.create).mock.calls[0]![0]).toBe(tx);
    expect(vi.mocked(referenceCounterRepository.nextReference).mock.calls[0]![0]).toBe(tx);
  });
});

describe('postStockMovement — rejections', () => {
  const rejects = async (input: PostStockMovementInput, error: typeof ValidationError | typeof ConflictError, message: RegExp) => {
    const attempt = postStockMovement(tx, input);
    await expect(attempt).rejects.toBeInstanceOf(error);
    await expect(attempt).rejects.toThrow(message);
    expect(ledgerRepository.create).not.toHaveBeenCalled();
  };

  it('rejects types no flow posts yet (SALE, MARKET_RECEIVE)', async () => {
    for (const type of ['SALE', 'MARKET_RECEIVE'] as const) {
      await rejects(base({ type }), ValidationError, /cannot be posted yet/);
    }
  });

  it('rejects an unknown type', async () => {
    await rejects(base({ type: 'NOT_A_TYPE' as never }), ValidationError, /cannot be posted yet/);
  });

  it('rejects a zero quantity, and a negative quantity on any type but ADJUSTMENT', async () => {
    await rejects(base({ quantity: D(0) }), ValidationError, /above zero/);
    await rejects(base({ quantity: D(-3) }), ValidationError, /positive number/);
    await rejects(base({ type: 'ADJUSTMENT', quantity: D(0), links: { stockCountLineId: 'cl-1' } }), ValidationError, /above zero/);
  });

  it('rejects a negative unit cost', async () => {
    await rejects(base({ unitCost: D(-1) }), ValidationError, /unit cost/);
  });

  it('rejects a missing source link', async () => {
    await rejects(base({ links: {} }), ValidationError, /exactly one of: wasteLogId/);
  });

  it('rejects two source links', async () => {
    await rejects(base({ links: { wasteLogId: 'w', dispatchLineId: 'd' } }), ValidationError, /exactly one/);
  });

  it('rejects a link the type does not allow', async () => {
    await rejects(base({ links: { purchaseDeliveryLineId: 'g' } }), ValidationError, /exactly one of: wasteLogId/);
  });

  it('rejects a location that does not exist', async () => {
    vi.mocked(ledgerRepository.findLocationOwner).mockResolvedValue(null);
    await rejects(base(), ValidationError, /location does not exist/);
  });

  it('keeps the hub rule: Central Store only on the hub, branch departments never on it', async () => {
    vi.mocked(ledgerRepository.findLocationOwner).mockResolvedValue({ ...storeLocation, siteIsHub: false });
    await rejects(base(), ValidationError, /hub site/);
    vi.mocked(ledgerRepository.findLocationOwner).mockResolvedValue({ ...kitchenLocation, siteIsHub: true });
    await rejects(base(), ValidationError, /cannot sit on the hub/);
  });

  it('rejects a link to a document that does not exist', async () => {
    vi.mocked(ledgerRepository.findLinkOwnerSites).mockResolvedValue(null);
    await rejects(base(), ValidationError, /does not exist/);
  });

  it('rejects a link to a document of another site', async () => {
    vi.mocked(ledgerRepository.findLinkOwnerSites).mockResolvedValue([branchSite]);
    await rejects(base(), ValidationError, /another site/);
  });
});

describe('postStockMovement — reversals', () => {
  const original = {
    id: 'orig-1',
    siteId: hubSite,
    locationId: storeLocation.id,
    inventoryItemId: 'item-1',
    type: 'ADJUSTMENT' as const,
    quantity: D(5),
    reversesTransactionId: null,
    alreadyReversed: false,
  };
  const reversal = (overrides: Partial<PostStockMovementInput> = {}) =>
    base({ type: 'ADJUSTMENT', quantity: D(-5), links: { stockCountLineId: 'cl-1' }, reversesTransactionId: 'orig-1', ...overrides });

  beforeEach(() => {
    vi.mocked(ledgerRepository.findForReversal).mockResolvedValue(original);
  });

  it('posts a linked reversal that undoes the original exactly', async () => {
    await postStockMovement(tx, reversal());
    expect(created().reversesTransactionId).toBe('orig-1');
    expect(created().quantity.toString()).toBe('-5');
    expect(created().reference).toBe('ADJ-0007');
  });

  it('rejects a second reversal of the same row', async () => {
    vi.mocked(ledgerRepository.findForReversal).mockResolvedValue({ ...original, alreadyReversed: true });
    const attempt = postStockMovement(tx, reversal());
    await expect(attempt).rejects.toBeInstanceOf(ConflictError);
    await expect(attempt).rejects.toThrow(/already been reversed/);
    expect(ledgerRepository.create).not.toHaveBeenCalled();
  });

  it('turns a racing second reversal (unique index) into the same conflict', async () => {
    vi.mocked(ledgerRepository.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(postStockMovement(tx, reversal())).rejects.toBeInstanceOf(ConflictError);
  });

  it('rejects a reversal that is not an adjustment, or whose target is missing, mismatched or not an adjustment', async () => {
    await expect(postStockMovement(tx, base({ reversesTransactionId: 'orig-1' }))).rejects.toThrow(/Only an adjustment or a prep row can reverse/);

    vi.mocked(ledgerRepository.findForReversal).mockResolvedValue(null);
    await expect(postStockMovement(tx, reversal())).rejects.toThrow(/does not exist/);

    vi.mocked(ledgerRepository.findForReversal).mockResolvedValue({ ...original, inventoryItemId: 'other-item' });
    await expect(postStockMovement(tx, reversal())).rejects.toThrow(/must match the original/);

    vi.mocked(ledgerRepository.findForReversal).mockResolvedValue({ ...original, type: 'WASTE' });
    await expect(postStockMovement(tx, reversal())).rejects.toThrow(/Only an adjustment can be reversed/);

    expect(ledgerRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a reversal for the wrong quantity', async () => {
    await expect(postStockMovement(tx, reversal({ quantity: D(-4) }))).rejects.toThrow(/undo the original quantity/);
    expect(ledgerRepository.create).not.toHaveBeenCalled();
  });
});

describe('postStockMovement — reversing a prep row', () => {
  const consume = {
    id: 'orig-c',
    siteId: hubSite,
    locationId: storeLocation.id,
    inventoryItemId: 'item-1',
    type: 'PREP_CONSUME' as const,
    quantity: D(-10),
    reversesTransactionId: null,
    alreadyReversed: false,
  };
  const produce = { ...consume, id: 'orig-p', type: 'PREP_PRODUCE' as const, quantity: D(38) };
  const reverse = (type: 'PREP_CONSUME' | 'PREP_PRODUCE', quantity: number, orig: string) =>
    base({ type, quantity: D(quantity), links: { prepRecordId: 'run-1' }, reversesTransactionId: orig });

  it('a reversed consume is stored positive, a reversed produce negative, both linked and of the original type', async () => {
    vi.mocked(ledgerRepository.findForReversal).mockResolvedValue(consume);
    await postStockMovement(tx, reverse('PREP_CONSUME', 10, 'orig-c'));
    expect(created().quantity.toString()).toBe('10');
    expect(created().type).toBe('PREP_CONSUME');
    expect(created().reversesTransactionId).toBe('orig-c');
    expect(created().reference).toBeNull();

    vi.mocked(ledgerRepository.create).mockClear();
    vi.mocked(ledgerRepository.findForReversal).mockResolvedValue(produce);
    await postStockMovement(tx, reverse('PREP_PRODUCE', 38, 'orig-p'));
    expect(created().quantity.toString()).toBe('-38');
    expect(created().type).toBe('PREP_PRODUCE');
  });

  it('refuses a wrong quantity, another item, another type, a second reversal and a reversal of a reversal', async () => {
    vi.mocked(ledgerRepository.findForReversal).mockResolvedValue(consume);
    await expect(postStockMovement(tx, reverse('PREP_CONSUME', 9, 'orig-c'))).rejects.toThrow(/undo the original quantity/);
    await expect(postStockMovement(tx, reverse('PREP_PRODUCE', 10, 'orig-c'))).rejects.toThrow(/same type/);

    vi.mocked(ledgerRepository.findForReversal).mockResolvedValue({ ...consume, inventoryItemId: 'other' });
    await expect(postStockMovement(tx, reverse('PREP_CONSUME', 10, 'orig-c'))).rejects.toThrow(/must match the original/);

    vi.mocked(ledgerRepository.findForReversal).mockResolvedValue({ ...consume, alreadyReversed: true });
    await expect(postStockMovement(tx, reverse('PREP_CONSUME', 10, 'orig-c'))).rejects.toBeInstanceOf(ConflictError);

    vi.mocked(ledgerRepository.findForReversal).mockResolvedValue({ ...consume, quantity: D(10), reversesTransactionId: 'x' });
    await expect(postStockMovement(tx, reverse('PREP_CONSUME', 10, 'orig-c'))).rejects.toThrow(/cannot be reversed/);

    expect(ledgerRepository.create).not.toHaveBeenCalled();
  });

  it('refuses a prep reversal at another location', async () => {
    vi.mocked(ledgerRepository.findForReversal).mockResolvedValue({ ...consume, locationId: 'elsewhere' });
    await expect(postStockMovement(tx, reverse('PREP_CONSUME', 10, 'orig-c'))).rejects.toThrow(/must match the original/);
  });
});
