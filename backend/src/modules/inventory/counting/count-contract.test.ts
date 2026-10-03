/**
 * Contract drift guard for the counting responses + the Session 2 **blindness
 * test** (plan §4.5): no attendant-facing count response contains the expected
 * quantity, a variance, on-hand or a unit cost — asserted on the serialized
 * JSON, not the TypeScript type.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countService } from './count-service';
import { countRepository } from './count-repository';
import { referenceCounterRepository } from '../purchasing/receiving-repository';
import { thresholdsRepository } from './thresholds-repository';
import { authRepository } from '../../../repositories/auth-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { locationRepository } from '../../../repositories/location-repository';
import { comparePin } from '../../../utils/password';
import {
  ApproveCountResultSchema,
  AttendantCountViewSchema,
  AttendantSaveResultSchema,
  AttendantSubmitResultSchema,
  CountListSchema,
  CountPrintSchema,
  VerifierCountViewSchema,
} from './count-validators';
import { AttendantStockSummarySchema } from '../stock/stock-validators';
import { attendant, centralStore, count, countId, D, hubOrgId, line, storeManager } from './count-test-fixtures';

const tx = { inventoryTransaction: { create: vi.fn() } };

vi.mock('./count-repository', () => ({
  countRepository: {
    listLiveCatalogItems: vi.fn(),
    listCategories: vi.fn(),
    findDaily: vi.fn(),
    findById: vi.fn(),
    createDraft: vi.fn(),
    addMissingLines: vi.fn(),
    setLineCount: vi.fn(),
    touch: vi.fn(),
    onHandByItem: vi.fn(),
    writeSnapshot: vi.fn(),
    markSubmitted: vi.fn(),
    markVerified: vi.fn(),
    listSummaries: vi.fn(),
    todaysDaily: vi.fn(),
  },
}));
vi.mock('../purchasing/receiving-repository', () => ({ referenceCounterRepository: { nextReference: vi.fn() } }));
vi.mock('./thresholds-repository', () => ({ thresholdsRepository: { findBySite: vi.fn() } }));
vi.mock('../../../repositories/auth-repository', () => ({ authRepository: { findUserByIdWithPassword: vi.fn() } }));
vi.mock('../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn(), findById: vi.fn() } }));
vi.mock('../../../repositories/location-repository', () => ({ locationRepository: { findCentralStore: vi.fn() } }));
vi.mock('../../../utils/password', () => ({ comparePin: vi.fn() }));
vi.mock('../../../services/fcm-service', () => ({
  fcmService: { sendCountSubmittedPush: vi.fn(), sendCountDirectorAlertPush: vi.fn() },
}));
vi.mock('../../../config/database', () => ({
  prisma: { $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) },
}));

/** Every key the blind count exists to hide. */
const FORBIDDEN = /expected|variance|onhand|on_hand|unitcost|reasonrequired|firstcounted|adjustment|directoralert/i;
const forbiddenKeys = (payload: unknown): string[] => {
  const found: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (FORBIDDEN.test(key)) found.push(key);
        walk(value);
      }
    }
  };
  walk(JSON.parse(JSON.stringify(payload)));
  return found;
};

// A line that carries every secret — the schemas must strip them all.
const secretLine = (n: number, overrides = {}) =>
  line(n, {
    countedQty: D(18),
    firstCountedQty: D(17),
    expectedQty: D(27),
    unitCost: D(90),
    decision: 'QUERIED',
    reasonRequired: true,
    reason: 'SUSPECTED_LOSS',
    queryNote: 'Recount the back shelf of the cold room.',
    ...overrides,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
  vi.mocked(locationRepository.findCentralStore).mockResolvedValue(centralStore as never);
  vi.mocked(authRepository.findUserByIdWithPassword).mockResolvedValue({ name: 'Sarah', pinHash: 'h' } as never);
  vi.mocked(comparePin).mockResolvedValue(true);
  vi.mocked(countRepository.listCategories).mockResolvedValue([
    { id: 'cat-dairy', name: 'Dairy', parentCategoryId: null },
    { id: 'cat-milk', name: 'Milk', parentCategoryId: 'cat-dairy' },
  ]);
  vi.mocked(countRepository.listLiveCatalogItems).mockResolvedValue([]);
  vi.mocked(thresholdsRepository.findBySite).mockResolvedValue(null);
  vi.mocked(countRepository.markSubmitted).mockResolvedValue(1);
  vi.mocked(countRepository.touch).mockResolvedValue(new Date('2026-09-12T04:08:00Z'));
  vi.mocked(countRepository.onHandByItem).mockResolvedValue(new Map());
  vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('ADJ-3402');
});

describe('Blind count — no attendant-facing count response reveals expected / variance / on-hand', () => {
  it('today\'s DRAFT sheet', async () => {
    vi.mocked(countRepository.findDaily).mockResolvedValue(
      count([secretLine(1, { decision: 'PENDING' }), secretLine(2)]),
    );
    const view = await countService.getToday(attendant);
    AttendantCountViewSchema.parse(view);
    expect(view.lines).toHaveLength(2);
    expect(forbiddenKeys(view)).toEqual([]);
    const json = JSON.stringify(view);
    expect(json).not.toContain('"27"'); // the expected figure itself
    expect(json).not.toContain('"90"'); // the unit cost
  });

  it('a RETURNED count — only the queried lines, note never states the figure', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(
      count(
        [
          secretLine(1, { decision: 'ACCEPTED', queryNote: null }),
          secretLine(2, { countedQty: null }),
        ],
        { status: 'RETURNED', returnNote: 'Just the chicken, please.', returnedAt: new Date(), returnedBy: { id: 'd0000000-0000-4000-8000-0000000000b1', name: 'Joseph Mwangi' } },
      ),
    );
    const view = await countService.getForAttendant(attendant, countId);
    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]).toMatchObject({ editable: true, countedQty: null });
    expect(view.returnedByName).toBe('Joseph Mwangi');
    expect(forbiddenKeys(view)).toEqual([]);
  });

  it('a SUBMITTED / VERIFIED count exposes no lines at all', async () => {
    for (const status of ['SUBMITTED', 'VERIFIED'] as const) {
      vi.mocked(countRepository.findById).mockResolvedValue(count([secretLine(1)], { status }));
      const view = await countService.getForAttendant(attendant, countId);
      expect(view.lines).toEqual([]);
      expect(forbiddenKeys(view)).toEqual([]);
    }
  });

  it('save-lines and submit results', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(count([secretLine(1, { decision: 'PENDING' })]));
    const saved = await countService.saveLines(attendant, countId, {
      lines: [{ inventoryItemId: line(1).inventoryItemId, countedQty: '18' }],
    });
    AttendantSaveResultSchema.parse(saved);
    expect(forbiddenKeys(saved)).toEqual([]);

    const submitted = await countService.submit(attendant, countId, '1234');
    AttendantSubmitResultSchema.parse(submitted);
    expect(forbiddenKeys(submitted)).toEqual([]);
  });

  it('the attendant\'s stock summary carries progress but no quantity', async () => {
    vi.mocked(countRepository.todaysDaily).mockResolvedValue({
      id: countId,
      status: 'DRAFT',
      counterSignedAt: null,
      counter: { name: 'Sarah Achieng' },
      countedLines: 8,
      totalLines: 142,
    });
    const { stockService } = await import('../stock/stock-service');
    const summary = await stockService.getSummary(attendant);
    AttendantStockSummarySchema.parse(summary);
    expect(summary).toEqual({
      todaysCount: { status: 'DRAFT', countId, submittedAt: null, submittedByName: null, countedLines: 8, totalLines: 142 },
    });
    expect(forbiddenKeys(summary)).toEqual([]);
  });

  it('the attendant cannot read the verifier view through the service', async () => {
    await expect(countService.getForVerifier(attendant as never, countId)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('control: the verifier view DOES carry the secrets (so the scan above can fail)', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(count([secretLine(1)], { status: 'SUBMITTED' }));
    const view = await countService.getForVerifier(storeManager, countId);
    expect(forbiddenKeys(view).length).toBeGreaterThan(0);
  });
});

describe('Store Manager shapes', () => {
  const submitted = () =>
    count(
      [
        line(1, { countedQty: D(124), expectedQty: D(124), unitCost: D(60), decision: 'ACCEPTED' }),
        line(2, { countedQty: D(18), expectedQty: D(27), unitCost: D(90), decision: 'ACCEPTED', reasonRequired: true, reason: 'SUSPECTED_LOSS' }),
        line(3),
      ],
      { status: 'SUBMITTED', counterSignedAt: new Date('2026-09-12T04:10:00Z') },
    );

  it('getForVerifier satisfies VerifierCountViewSchema and derives variance / totals', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(submitted());
    const view = await countService.getForVerifier(storeManager, countId);
    VerifierCountViewSchema.parse(view);
    expect(view.totals).toEqual({
      lines: 2,
      uncountedLines: 1,
      matchedLines: 1,
      varianceLines: 1,
      aboveThreshold: 1,
      queriedLines: 0,
      netVarianceValue: '-810',
    });
    expect(view.lines[1]).toMatchObject({ variance: '-9', varianceValue: '-810', reasonRequired: true, directorAlert: false });
    expect(view.thresholds).toEqual({ reasonRequiredKes: 500, directorAlertKes: 5000 });
  });

  it('approve satisfies ApproveCountResultSchema', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(submitted());
    ApproveCountResultSchema.parse(await countService.approve(storeManager, countId, '1234'));
  });

  it('list satisfies CountListSchema and puts what awaits the Store Manager first', async () => {
    vi.mocked(countRepository.listSummaries).mockResolvedValue([
      { ...submitted(), lines: submitted().lines.map((l) => ({ ...l, transactions: [] })) },
    ] as never);
    const list = await countService.list(storeManager, { limit: 30 });
    CountListSchema.parse(list);
    expect(list.counts[0]).toMatchObject({ reference: 'CNT-2026-0912', itemCount: 2, totalLines: 3, varianceLines: 1 });
  });

  it('print satisfies CountPrintSchema', async () => {
    vi.mocked(countRepository.findById).mockResolvedValue(
      count(
        [
          line(2, {
            countedQty: D(18),
            expectedQty: D(27),
            unitCost: D(90),
            decision: 'ACCEPTED',
            reason: 'SUSPECTED_LOSS',
            transactions: [{ id: 'tx1', reference: 'ADJ-3402' }],
          }),
        ],
        { status: 'VERIFIED', verifier: { id: 'd0000000-0000-4000-8000-0000000000b1', name: 'Joseph Mwangi' }, verifiedAt: new Date(), counterSignedAt: new Date() },
      ),
    );
    const print = await countService.print(storeManager, countId);
    CountPrintSchema.parse(print);
    expect(print.adjustments).toEqual([
      { itemName: 'Item 2', usageUnit: 'kg', variance: '-9', reference: 'ADJ-3402', value: '-810', reason: 'Suspected loss' },
    ]);
  });
});
