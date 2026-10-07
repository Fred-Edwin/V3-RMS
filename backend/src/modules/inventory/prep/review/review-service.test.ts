import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { prepRunRepository, type PrepRunRow } from '../_shared/prep-run-repository';
import { nairobiWeekStart, runsService } from '../runs/runs-service';
import { runsSummaryRepository } from '../runs/runs-summary-repository';
import { CSV_BOM, runsToCsv } from './review-csv';
import { reasonsFor } from './review-reasons';
import { reviewRepository } from './review-repository';
import { EXPORT_MAX_ROWS, reviewService } from './review-service';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../config/database', () => ({ prisma: {} }));
vi.mock('../_shared/prep-run-repository', () => ({ prepRunRepository: { findById: vi.fn(), list: vi.fn() } }));
vi.mock('./review-repository', () => ({ reviewRepository: { listNeedsLook: vi.fn(), countNeedsLook: vi.fn(), markReviewed: vi.fn(), exportRows: vi.fn() } }));
vi.mock('../runs/runs-summary-repository', () => ({ runsSummaryRepository: { countRecordedSince: vi.fn(), inputCostSince: vi.fn() } }));

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const HUB = 'hub-1';
const manager = { id: 'sm', role: 'STORE_MANAGER', siteId: HUB } as never;
const accountant = { id: 'acc', role: 'ACCOUNTANT', siteId: HUB } as never;
const attendant = { id: 'att', role: 'STORE_ATTENDANT', siteId: HUB } as never;

const row = (over: Partial<PrepRunRow> = {}): PrepRunRow =>
  ({
    id: 'run-1', siteId: HUB, reference: 'PREP-0007', outputItemId: 'o', actualYield: D(30), outputUnitCost: D(121), totalInputCost: D(3630),
    yieldVarianceLabel: 'low yield', notifiedStoreManager: false, locationId: 'l', createdById: 'att', createdAt: new Date('2026-10-07T05:15:00Z'),
    status: 'RECORDED', replacesRunId: null, closedAt: null, closedById: null, correctionReason: null, cancelReason: null, reasonNote: null, yieldReason: null,
    expectedYield: D(38), expectedSource: 'RECIPE', recipeVersionId: 'v', stockFlag: false, needsLook: true, reviewedAt: null, reviewedById: null, idempotencyKey: 'k',
    outputItem: { id: 'o', name: 'Marinated chicken', usageUnit: 'portions' },
    createdBy: { id: 'att', name: 'Sarah Achieng', role: 'STORE_ATTENDANT' },
    closedBy: null, reviewedBy: null, replacesRun: null, replacedByRun: null, recipeVersion: { version: 1 },
    inputLines: [{ id: 'i', prepRunId: 'run-1', inputItemId: 'c', quantity: D(10), unitCostAtRunTime: D(430), lineCost: D(4300), lineOrder: 0, onHandAtRunTime: D(40), inputItem: { id: 'c', name: 'chicken', usageUnit: 'kg' } }],
    ...over,
  }) as PrepRunRow;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(prepRunRepository.findById).mockResolvedValue(row());
  vi.mocked(reviewRepository.listNeedsLook).mockResolvedValue([row()]);
  vi.mocked(reviewRepository.countNeedsLook).mockResolvedValue(4);
  vi.mocked(reviewRepository.markReviewed).mockResolvedValue(true);
  vi.mocked(reviewRepository.exportRows).mockResolvedValue([row()]);
});

describe('reasons (the chips on Needs a look)', () => {
  it('names a low yield with how far under the usual it was', () => {
    expect(reasonsFor(row({ actualYield: D(28) }))).toEqual(['Low yield · 10 portions under usual']);
    expect(reasonsFor(row({ actualYield: D(50) }))).toEqual(['High yield · 12 portions over usual']);
  });

  it('says nothing about a yield that is on target', () => {
    expect(reasonsFor(row({ actualYield: D(37) }))).toEqual([]);
  });

  it('names each ingredient that went over the stock, capitalised', () => {
    const lines = [
      { inputItemId: 'b', quantity: D(8), onHandAtRunTime: D(5), inputItem: { id: 'b', name: 'beef mince', usageUnit: 'kg' } },
      { inputItemId: 'c', quantity: D(1), onHandAtRunTime: D(5), inputItem: { id: 'c', name: 'salt', usageUnit: 'kg' } },
    ] as PrepRunRow['inputLines'];
    expect(reasonsFor(row({ actualYield: D(38), stockFlag: true, inputLines: lines }))).toEqual(['Beef mince used more than expected']);
  });

  it('quotes what the Attendant said, and flags a correction', () => {
    expect(reasonsFor(row({ actualYield: D(38), yieldReason: 'SPILLAGE' }))).toEqual(['Said: spillage']);
    expect(reasonsFor(row({ actualYield: D(38), yieldReason: 'TRIMMED_MORE' }))).toEqual(['Said: trimmed more']);
    expect(reasonsFor(row({ actualYield: D(38), yieldReason: 'OTHER', reasonNote: 'power cut' }))).toEqual(['Said: power cut']);
    expect(reasonsFor(row({ actualYield: D(38), replacesRunId: 'old' }))).toEqual(['Corrected']);
  });

  it('puts them in the order the manager should care', () => {
    expect(reasonsFor(row({ actualYield: D(28), yieldReason: 'SPILLAGE', replacesRunId: 'old' }))).toEqual(['Low yield · 10 portions under usual', 'Said: spillage', 'Corrected']);
  });
});

describe('needs a look (#14, #15)', () => {
  it('lists the queue with reasons and the total, scoped to the hub', async () => {
    const out = await reviewService.needsLook(manager, { page: 1, perPage: 25 });
    expect(out.count).toBe(4);
    expect(out.items[0]).toMatchObject({ reference: 'PREP-0007', needsLook: true, reasons: ['Low yield · 8 portions under usual'] });
    expect(reviewRepository.listNeedsLook).toHaveBeenCalledWith(HUB, 1, 25);
  });

  it('counts for the badge with one cheap call', async () => {
    expect(await reviewService.count(manager)).toEqual({ count: 4 });
    expect(reviewRepository.countNeedsLook).toHaveBeenCalledWith(HUB);
    expect(reviewRepository.listNeedsLook).not.toHaveBeenCalled();
  });
});

describe('mark reviewed (#16)', () => {
  const now = new Date('2026-10-07T09:00:00Z');

  it('stamps the reviewer and returns the fresh run', async () => {
    vi.mocked(prepRunRepository.findById)
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(row({ needsLook: false, reviewedAt: now, reviewedById: 'sm', reviewedBy: { id: 'sm', name: 'Grace Wanjiru', role: 'STORE_MANAGER' } }));
    const out = await reviewService.review(manager, 'run-1', now);
    expect(reviewRepository.markReviewed).toHaveBeenCalledWith(HUB, 'run-1', 'sm', now);
    expect(out).toMatchObject({ needsLook: false, reviewedBy: { name: 'Grace Wanjiru' } });
  });

  it('is idempotent: a reviewed run comes back unchanged and nothing is written', async () => {
    vi.mocked(prepRunRepository.findById).mockResolvedValue(row({ needsLook: false, reviewedAt: now, reviewedById: 'sm' }));
    await reviewService.review(manager, 'run-1', now);
    expect(reviewRepository.markReviewed).not.toHaveBeenCalled();
  });

  it('409 RUN_NOT_OPEN for a cancelled run and for a corrected original', async () => {
    for (const status of ['CANCELLED', 'CORRECTED'] as const) {
      vi.mocked(prepRunRepository.findById).mockResolvedValue(row({ status }));
      await expect(reviewService.review(manager, 'run-1', now)).rejects.toMatchObject({ statusCode: 409, code: 'RUN_NOT_OPEN' });
    }
    expect(reviewRepository.markReviewed).not.toHaveBeenCalled();
  });

  it('409 when the run was cancelled between the read and the write', async () => {
    vi.mocked(reviewRepository.markReviewed).mockResolvedValue(false);
    vi.mocked(prepRunRepository.findById).mockResolvedValue(row({ status: 'CANCELLED' }));
    vi.mocked(prepRunRepository.findById).mockResolvedValueOnce(row());
    await expect(reviewService.review(manager, 'run-1', now)).rejects.toMatchObject({ code: 'RUN_NOT_OPEN' });
  });

  it('a double click that loses the race still returns the run, reviewed once', async () => {
    vi.mocked(reviewRepository.markReviewed).mockResolvedValue(false);
    vi.mocked(prepRunRepository.findById).mockResolvedValueOnce(row()).mockResolvedValueOnce(row({ needsLook: false, reviewedAt: now, reviewedById: 'other' }));
    await expect(reviewService.review(manager, 'run-1', now)).resolves.toMatchObject({ needsLook: false });
  });

  it('404 for an unknown run', async () => {
    vi.mocked(prepRunRepository.findById).mockResolvedValue(null);
    await expect(reviewService.review(manager, 'x')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('export (#17)', () => {
  const now = new Date('2026-10-07T09:00:00Z');

  it('starts with the BOM, has the contract columns, and a Nairobi time', async () => {
    const { csv, fileName } = await reviewService.exportCsv(accountant, { from: '2026-10-01', to: '2026-10-07' }, now);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [header, line] = csv.slice(1).split('\r\n');
    expect(header).toBe('When,Run,Output,Made,Unit,Vs usual,By,Status,Reviewed by,Unit cost');
    expect(line).toBe('2026-10-07 08:15,PREP-0007,Marinated chicken,30,portions,−8 portions · low yield,Sarah Achieng,Recorded,,121');
    expect(fileName).toBe('prep-history-2026-10-01-2026-10-07.csv');
  });

  it('has no cost column for a caller without prep.see_costs (the header too, even with no rows)', async () => {
    vi.mocked(reviewRepository.exportRows).mockResolvedValue([]);
    const { csv } = await reviewService.exportCsv(attendant, {}, now);
    expect(csv.slice(1).split('\r\n')[0]).toBe('When,Run,Output,Made,Unit,Vs usual,By,Status,Reviewed by');
    vi.mocked(reviewRepository.exportRows).mockResolvedValue([row()]);
    expect((await reviewService.exportCsv(attendant, {}, now)).csv).not.toContain('121');
  });

  it('names an open-ended export from the start to today in Nairobi', async () => {
    const { fileName } = await reviewService.exportCsv(manager, {}, new Date('2026-10-07T22:30:00Z'));
    expect(fileName).toBe('prep-history-start-2026-10-08.csv');
  });

  it('passes the filters through as Nairobi days, honouring needsLook and mine', async () => {
    await reviewService.exportCsv(manager, { status: 'CANCELLED', needsLook: true, mine: true, search: 'chick', from: '2026-10-07', to: '2026-10-07' }, now);
    const [site, filters, take] = vi.mocked(reviewRepository.exportRows).mock.calls[0]!;
    expect(site).toBe(HUB);
    expect(filters).toMatchObject({ status: 'CANCELLED', needsLook: true, mineUserId: 'sm', search: 'chick' });
    expect(filters.from?.toISOString()).toBe('2026-10-06T21:00:00.000Z');
    expect(filters.to?.toISOString()).toBe('2026-10-07T21:00:00.000Z');
    expect(take).toBe(EXPORT_MAX_ROWS + 1);
  });

  it('422 EXPORT_TOO_LARGE beyond 10,000 rows, and exactly 10,000 is fine', async () => {
    vi.mocked(reviewRepository.exportRows).mockResolvedValue(Array.from({ length: EXPORT_MAX_ROWS + 1 }, () => row()));
    await expect(reviewService.exportCsv(manager, {}, now)).rejects.toMatchObject({ statusCode: 422, code: 'EXPORT_TOO_LARGE' });
    vi.mocked(reviewRepository.exportRows).mockResolvedValue(Array.from({ length: EXPORT_MAX_ROWS }, () => row()));
    await expect(reviewService.exportCsv(manager, {}, now)).resolves.toBeDefined();
  });
});

describe('CSV cells', () => {
  const summary = (over: Record<string, unknown> = {}) =>
    ({
      id: 'r', reference: 'PREP-1', at: '2026-10-07T05:15:00.000Z', outputItemId: 'o', outputName: 'Soup', inputsPreview: { firstLabel: '', moreCount: 0 },
      made: '4', unit: 'L', vsUsual: { label: 'ON_TARGET', deltaAmount: '0', text: 'on target' }, status: 'CORRECTED', isCorrection: false,
      by: { id: 'u', name: 'Ann', initials: 'A', roleLabel: 'x' }, mine: false, ...over,
    }) as never;

  it('quotes commas and quotes, and defuses a name that would run as a formula', () => {
    const csv = runsToCsv([summary({ outputName: 'Soup, "spicy"', by: { id: 'u', name: '=HYPERLINK("x")', initials: 'A', roleLabel: 'x' } })], false);
    expect(csv).toContain('"Soup, ""spicy"""');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toContain(',Corrected,');
  });

  it('leaves a signed "vs usual" alone', () => {
    expect(runsToCsv([summary({ vsUsual: { label: 'HIGH', deltaAmount: '+0.3', text: '+0.3 L · high yield' } })], false)).toContain(',+0.3 L · high yield,');
  });
});

describe('summary (#9)', () => {
  const now = new Date('2026-10-07T09:00:00Z'); // Wednesday, Nairobi

  beforeEach(() => {
    vi.mocked(runsSummaryRepository.countRecordedSince).mockResolvedValueOnce(9).mockResolvedValueOnce(2);
    vi.mocked(runsSummaryRepository.inputCostSince).mockResolvedValue('84500');
  });

  it('counts this week since Monday and today since Nairobi midnight, and adds the value with prep.see_costs', async () => {
    const out = await runsService.summary(manager, now);
    expect(out).toEqual({ runsThisWeek: 9, runsToday: 2, needsLookCount: 4, prepValue7d: '84500' });
    const [week, today] = vi.mocked(runsSummaryRepository.countRecordedSince).mock.calls;
    expect(week![1].toISOString()).toBe('2026-10-04T21:00:00.000Z'); // Monday 5 Oct, 00:00 Nairobi
    expect(today![1].toISOString()).toBe('2026-10-06T21:00:00.000Z'); // Wednesday 7 Oct, 00:00 Nairobi
    expect(vi.mocked(runsSummaryRepository.inputCostSince).mock.calls[0]![1].toISOString()).toBe('2026-09-30T09:00:00.000Z');
  });

  it('never carries the prep value for a caller blind to costs', async () => {
    // No built-in desktop role is blind to prep costs; the Attendant is, and is refused at the route before reaching here.
    const out = await runsService.summary(attendant, now);
    expect(out).not.toHaveProperty('prepValue7d');
    expect(runsSummaryRepository.inputCostSince).not.toHaveBeenCalled();
  });

  it('the week starts on Monday in Nairobi, including on a Sunday and just after midnight', () => {
    expect(nairobiWeekStart(new Date('2026-10-11T10:00:00Z')).toISOString()).toBe('2026-10-04T21:00:00.000Z'); // Sunday 11 Oct
    expect(nairobiWeekStart(new Date('2026-10-04T21:30:00Z')).toISOString()).toBe('2026-10-04T21:00:00.000Z'); // Monday 00:30 Nairobi
    expect(nairobiWeekStart(new Date('2026-10-04T20:30:00Z')).toISOString()).toBe('2026-09-27T21:00:00.000Z'); // Sunday 23:30 Nairobi
  });
});
