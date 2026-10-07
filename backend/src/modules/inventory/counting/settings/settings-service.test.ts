import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../../../../repositories/branch-repository';
import { settingsRepository, type CountSettingsRecord, type SignedLineFigures } from './settings-repository';
import { previewOf, type PreviewSettings } from './settings-preview';
import { settingsService, settingsView } from './settings-service';
import { countingThresholdsRow } from './settings-fixtures';

vi.mock('../../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../../config/database', () => ({ prisma: {} }));
vi.mock('./settings-repository', () => ({ settingsRepository: { find: vi.fn(), saveRange: vi.fn(), saveDirectorAlert: vi.fn(), signedLinesSince: vi.fn() } }));

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const HUB = 'hub-1';
const storeManager = { id: 'sm', role: 'STORE_MANAGER', siteId: HUB } as never;
const director = { id: 'dir', role: 'DIRECTOR', siteId: HUB } as never;
const admin = { id: 'admin', role: 'SYSTEM_ADMIN', siteId: null } as never;
const accountant = { id: 'acc', role: 'ACCOUNTANT', siteId: HUB } as never;
const attendant = { id: 'att', role: 'STORE_ATTENDANT', siteId: HUB } as never;
const branchManager = { id: 'bm', role: 'MANAGER', siteId: 'branch-1' } as never;
const now = new Date('2026-10-13T06:00:00Z');

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: HUB } as never);
  vi.mocked(settingsRepository.find).mockResolvedValue(null);
});

describe('C23 get', () => {
  it('with no row: KES 500, 5 %, repeat on, Director alert KES 5,000, nobody has set them', async () => {
    expect(await settingsService.get(storeManager)).toEqual({
      rangeKes: 500,
      rangePercent: '5',
      flagRepeatShortfalls: true,
      directorAlertKes: 5000,
      rangeUpdatedBy: null,
      rangeUpdatedAt: null,
      alertUpdatedBy: null,
      alertUpdatedAt: null,
      can: { editRange: true, editDirectorAlert: false },
    });
  });

  it('with a row: who set each number and when, and what the caller may change', async () => {
    vi.mocked(settingsRepository.find).mockResolvedValue(countingThresholdsRow());
    const asManager = await settingsService.get(storeManager);
    expect(asManager).toMatchObject({
      rangeKes: 300,
      rangePercent: '8.5',
      flagRepeatShortfalls: false,
      directorAlertKes: 1500,
      rangeUpdatedBy: { id: 'sm', name: 'Isabel Njoki', initials: 'IN', roleLabel: 'Store Manager' },
      rangeUpdatedAt: '2026-10-01T06:00:00.000Z',
      alertUpdatedBy: { id: 'dir', name: 'Grace Wambui', roleLabel: 'Director' },
      alertUpdatedAt: '2026-09-20T06:00:00.000Z',
      can: { editRange: true, editDirectorAlert: false },
    });
    expect((await settingsService.get(director)).can).toEqual({ editRange: false, editDirectorAlert: true });
    expect((await settingsService.get(admin)).can).toEqual({ editRange: true, editDirectorAlert: true });
    expect((await settingsService.get(accountant)).can).toEqual({ editRange: false, editDirectorAlert: false });
  });

  it('an alert amount never set falls back to KES 5,000 even when the range row exists', async () => {
    vi.mocked(settingsRepository.find).mockResolvedValue(countingThresholdsRow({ directorAlertKes: null, directorUpdatedBy: null, directorUpdatedAt: null }));
    expect(await settingsService.get(storeManager)).toMatchObject({ directorAlertKes: 5000, alertUpdatedBy: null, alertUpdatedAt: null });
  });

  it('every desktop role reads it, from wherever they stand; the hub is always the site read', async () => {
    for (const actor of [storeManager, director, admin, accountant, branchManager]) {
      await settingsService.get(actor);
      expect(settingsRepository.find).toHaveBeenLastCalledWith(HUB);
    }
  });

  it('settingsView reads the capability table, never a role', () => {
    expect(settingsView(null, { role: 'STORE_ATTENDANT' } as never).can).toEqual({ editRange: false, editDirectorAlert: false });
  });
});

describe('C25 update range', () => {
  const input = { rangeKes: 400, rangePercent: '7.5', flagRepeatShortfalls: false };

  it('saves the three values under the caller’s name, and returns the settings as saved', async () => {
    vi.mocked(settingsRepository.saveRange).mockResolvedValue(countingThresholdsRow({ reasonRequiredKes: 400, rangePercent: D('7.5'), flagRepeatShortfalls: false }));
    const out = await settingsService.updateRange(storeManager, input);
    expect(settingsRepository.saveRange).toHaveBeenCalledWith(HUB, { rangeKes: 400, rangePercent: D('7.5'), flagRepeatShortfalls: false, updatedById: 'sm' });
    expect(out).toMatchObject({ rangeKes: 400, rangePercent: '7.5', flagRepeatShortfalls: false });
  });

  it('rounds the percent to the two places the column keeps', async () => {
    vi.mocked(settingsRepository.saveRange).mockResolvedValue(countingThresholdsRow());
    await settingsService.updateRange(storeManager, { ...input, rangePercent: '7.555' });
    expect(vi.mocked(settingsRepository.saveRange).mock.calls[0]![1].rangePercent.toString()).toBe('7.56');
  });

  it('refuses a non-hub caller (D-15)', async () => {
    await expect(settingsService.updateRange(branchManager, input)).rejects.toMatchObject({ statusCode: 403 });
    expect(settingsRepository.saveRange).not.toHaveBeenCalled();
  });
});

describe('C26 update Director alert', () => {
  it('saves only the amount, stamped with the caller and the time, and leaves the range stamp alone', async () => {
    const existing = countingThresholdsRow();
    vi.mocked(settingsRepository.find).mockResolvedValue(existing);
    vi.mocked(settingsRepository.saveDirectorAlert).mockResolvedValue(countingThresholdsRow({ directorAlertKes: 8000 }));
    const out = await settingsService.updateDirectorAlert(director, { alertKes: 8000 }, now);
    expect(settingsRepository.saveDirectorAlert).toHaveBeenCalledWith(HUB, { alertKes: 8000, updatedById: 'dir', at: now, keepRangeStamp: existing.updatedAt });
    expect(out.directorAlertKes).toBe(8000);
    expect(settingsRepository.saveRange).not.toHaveBeenCalled();
  });

  it('the first save with no row has no range stamp to keep', async () => {
    vi.mocked(settingsRepository.saveDirectorAlert).mockResolvedValue(countingThresholdsRow({ directorAlertKes: 8000, updatedBy: null }));
    await settingsService.updateDirectorAlert(director, { alertKes: 8000 }, now);
    expect(vi.mocked(settingsRepository.saveDirectorAlert).mock.calls[0]![1].keepRangeStamp).toBeNull();
  });

  it('refuses a non-hub caller', async () => {
    await expect(settingsService.updateDirectorAlert(branchManager, { alertKes: 1 }, now)).rejects.toMatchObject({ statusCode: 403 });
    expect(settingsRepository.saveDirectorAlert).not.toHaveBeenCalled();
  });
});

describe('C24 preview', () => {
  const line = (countId: string, counted: number, expected: number, cost: number): SignedLineFigures => ({ countId, counted: D(counted), expected: D(expected), unitCost: D(cost) });

  it('asks for the last seven days and judges them with the proposed numbers; what is left out stays as it is today', async () => {
    vi.mocked(settingsRepository.signedLinesSince).mockResolvedValue([line('c1', 95, 100, 1), line('c1', 90, 100, 1)]); // 5 % and 10 %, KES 5 and 10
    const preview = await settingsService.preview(storeManager, { rangePercent: '10' }, now);
    expect(settingsRepository.signedLinesSince).toHaveBeenCalledWith(HUB, new Date('2026-10-06T06:00:00Z'));
    expect(preview.range).toMatchObject({ withinRange: 2, outsideRange: 0 });
  });

  it('with nothing proposed it is today’s numbers and no what-if hint', async () => {
    vi.mocked(settingsRepository.signedLinesSince).mockResolvedValue([line('c1', 95, 100, 1), line('c1', 90, 100, 1)]);
    const preview = await settingsService.preview(director, {}, now);
    expect(preview.range).toEqual({ withinRange: 1, outsideRange: 1, hint: null });
  });
});

describe('previewOf: the last seven days judged again', () => {
  const line = (countId: string, counted: number, expected: number, cost: number): SignedLineFigures => ({ countId, counted: D(counted), expected: D(expected), unitCost: D(cost) });
  const today: PreviewSettings = { rangeKes: 500, rangePercent: D(5), directorAlertKes: 5000 };

  // 100 expected at KES 1: 96 is 4 % (within), 92 is 8 % (outside today, inside at 8), 85 is 15 % (outside both).
  const rows = [line('c1', 96, 100, 1), line('c1', 92, 100, 1), line('c1', 85, 100, 1), line('c2', 100, 100, 1)];

  it('counts within and outside, leaving matched lines out of both', () => {
    expect(previewOf(rows, today, today)).toMatchObject({ range: { withinRange: 1, outsideRange: 2, hint: null } });
  });

  it('raising the percentage says how many lines move into range, in the voice of Paper step 25', () => {
    const preview = previewOf(rows, today, { ...today, rangePercent: D(8) });
    expect(preview.range).toEqual({
      withinRange: 2,
      outsideRange: 1,
      hint: 'Raising the percentage to 8 would move 1 line into range. Nothing changes for counts already signed.',
    });
  });

  it('lowering the percentage says how many lines move out', () => {
    const preview = previewOf(rows, today, { ...today, rangePercent: D(3) });
    expect(preview.range.hint).toBe('Lowering the percentage to 3 would move 1 line out of range. Nothing changes for counts already signed.');
    expect(preview.range).toMatchObject({ withinRange: 0, outsideRange: 3 });
  });

  it('changing the amount names the amount; a change that moves nothing says so', () => {
    // The 4 % line is worth KES 4: a KES 3 range pushes it out; the 8 % and 15 % lines were already out.
    expect(previewOf(rows, today, { ...today, rangeKes: 3 }).range.hint).toBe('Lowering the amount to KES 3 would move 1 line out of range. Nothing changes for counts already signed.');
    expect(previewOf([line('c1', 99, 100, 1)], today, { ...today, rangeKes: 600 }).range.hint).toBe('Changing the amount to KES 600 would not move any of these lines. Nothing changes for counts already signed.');
  });

  it('the alert: counts whose largest line reaches the amount, and what a proposed amount would have done (Paper step 45)', () => {
    const big = [line('c1', 40, 100, 100), line('c2', 90, 100, 100), line('c3', 10, 100, 100), line('c3', 99, 100, 100)]; // KES 6,000, 1,000, 9,000 and 100
    const same = previewOf(big, today, today);
    expect(same.alert).toEqual({ countsOver: 2, hint: '2 counts went over KES 5,000.' });
    const what = previewOf(big, today, { ...today, directorAlertKes: 8000 });
    expect(what.alert).toEqual({ countsOver: 2, hint: '2 counts went over KES 5,000. At KES 8,000 it would have been 1.' });
  });

  it('no count over the amount, and a tie at the amount counts as over', () => {
    expect(previewOf([line('c1', 99, 100, 1)], today, today).alert).toEqual({ countsOver: 0, hint: 'No count went over KES 5,000.' });
    expect(previewOf([line('c1', 50, 100, 100)], today, today).alert.countsOver).toBe(1); // exactly KES 5,000
  });

  it('nothing signed in the last seven days is all zeros', () => {
    expect(previewOf([], today, today)).toEqual({ range: { withinRange: 0, outsideRange: 0, hint: null }, alert: { countsOver: 0, hint: 'No count went over KES 5,000.' } });
  });
});

describe('the record type', () => {
  it('is the thresholds row with the two people who set it', () => {
    const row: CountSettingsRecord = countingThresholdsRow();
    expect(row.siteId).toBe(HUB);
  });
});
