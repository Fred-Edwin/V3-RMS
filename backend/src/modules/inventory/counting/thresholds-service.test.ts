// kept for the branch-day refactor: delete when branch day is redone
/**
 * Thresholds (plan §1.9, §4.5): defaults with no row, role-chosen write
 * schemas, only DIRECTOR sets the company-wide amount, the SM write never
 * touches it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { thresholdsService } from './thresholds-service';
import { thresholdsRepository } from './thresholds-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { UpdateBranchThresholdsSchema, UpdateDirectorThresholdSchema, UpdateStoreThresholdsSchema } from './thresholds-validators';
// The two fixtures this file used from the deleted count-test-fixtures.ts.
const hubOrgId = '11111111-1111-4111-8111-111111111111';
const storeManager = { id: 'sm1', role: 'STORE_MANAGER' as const, siteId: hubOrgId };

vi.mock('./thresholds-repository', () => ({
  thresholdsRepository: { findBySite: vi.fn(), upsertStoreReason: vi.fn(), upsertBranch: vi.fn(), upsertDirectorAlert: vi.fn() },
}));
vi.mock('../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));

const director = { id: 'd1', role: 'DIRECTOR' as const, siteId: null };
const branchManager = { id: 'bm1', role: 'MANAGER' as const, siteId: 'branch-1' };
const row = (over = {}) => ({
  id: 't1',
  siteId: hubOrgId,
  reasonRequiredKes: 800,
  overnightAlertKes: null,
  directorAlertKes: 5000,
  updatedById: 'sm1',
  directorUpdatedById: null,
  directorUpdatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date('2026-09-10T08:00:00Z'),
  updatedBy: { id: 'sm1', name: 'Joseph Mwangi' },
  directorUpdatedBy: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
});

describe('thresholds', () => {
  it('defaults apply when no row exists (hub 500 / Director 5,000; branch 1,000 / 500)', async () => {
    vi.mocked(thresholdsRepository.findBySite).mockResolvedValue(null);
    expect(await thresholdsService.get(storeManager)).toMatchObject({
      reasonRequiredKes: 500,
      overnightAlertKes: null,
      directorAlertKes: 5000,
      isDefault: true,
      updatedBy: null,
    });
    expect(await thresholdsService.get(branchManager)).toMatchObject({
      reasonRequiredKes: 1000,
      overnightAlertKes: 500,
      directorAlertKes: 5000,
      isDefault: true,
    });
  });

  it('reads who last changed the Store Manager value', async () => {
    vi.mocked(thresholdsRepository.findBySite).mockResolvedValue(row() as never);
    expect(await thresholdsService.get(storeManager)).toMatchObject({
      reasonRequiredKes: 800,
      isDefault: false,
      updatedBy: { name: 'Joseph Mwangi' },
      updatedAt: '2026-09-10T08:00:00.000Z',
    });
  });

  it('the Store Manager write keeps the Director amount', async () => {
    vi.mocked(thresholdsRepository.findBySite).mockResolvedValue(row({ directorAlertKes: 7500 }) as never);
    vi.mocked(thresholdsRepository.upsertStoreReason).mockResolvedValue(row({ reasonRequiredKes: 300, directorAlertKes: 7500 }) as never);
    await thresholdsService.updateStore(storeManager, { reasonRequiredKes: 300 });
    expect(thresholdsRepository.upsertStoreReason).toHaveBeenCalledWith(hubOrgId, {
      reasonRequiredKes: 300,
      directorAlertKes: 7500,
      updatedById: 'sm1',
    });
  });

  it('the Store Manager cannot send branch or Director fields; values are bounded', () => {
    expect(UpdateStoreThresholdsSchema.safeParse({ reasonRequiredKes: 300, overnightAlertKes: 1 }).success).toBe(false);
    expect(UpdateStoreThresholdsSchema.safeParse({ reasonRequiredKes: 300, directorAlertKes: 1 }).success).toBe(false);
    expect(UpdateStoreThresholdsSchema.safeParse({ reasonRequiredKes: -1 }).success).toBe(false);
    expect(UpdateStoreThresholdsSchema.safeParse({ reasonRequiredKes: 1_000_001 }).success).toBe(false);
    expect(UpdateStoreThresholdsSchema.safeParse({ reasonRequiredKes: 1.5 }).success).toBe(false);
    expect(UpdateStoreThresholdsSchema.safeParse({ reasonRequiredKes: 0 }).success).toBe(true); // 0 = always
    expect(UpdateDirectorThresholdSchema.safeParse({ directorAlertKes: 6000, reasonRequiredKes: 1 }).success).toBe(false);
  });

  it('only a Director sets the company-wide amount', async () => {
    await expect(thresholdsService.updateDirector(storeManager as never, { directorAlertKes: 1 })).rejects.toMatchObject({ statusCode: 403 });
    await expect(thresholdsService.updateDirector(branchManager as never, { directorAlertKes: 1 })).rejects.toMatchObject({ statusCode: 403 });
    vi.mocked(thresholdsRepository.findBySite).mockResolvedValue(null);
    vi.mocked(thresholdsRepository.upsertDirectorAlert).mockResolvedValue(
      row({ directorAlertKes: 8000, directorUpdatedById: 'd1', directorUpdatedAt: new Date(), directorUpdatedBy: { id: 'd1', name: 'Director' } }) as never,
    );
    const result = await thresholdsService.updateDirector(director as never, { directorAlertKes: 8000 });
    expect(result.directorAlertKes).toBe(8000);
    expect(thresholdsRepository.upsertDirectorAlert).toHaveBeenCalledWith(hubOrgId, {
      directorAlertKes: 8000,
      reasonRequiredKes: 500,
      updatedById: 'd1',
    });
  });

  it('a Store Manager write is refused for anyone else', async () => {
    await expect(thresholdsService.updateStore(branchManager as never, { reasonRequiredKes: 1 })).rejects.toMatchObject({ statusCode: 403 });
    await expect(thresholdsService.updateStore({ ...storeManager, siteId: 'x' }, { reasonRequiredKes: 1 })).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('branch thresholds (Session 3)', () => {
  it('a Branch Manager writes their own branch row only — the org always comes from the actor', async () => {
    vi.mocked(thresholdsRepository.findBySite).mockResolvedValue(null);
    vi.mocked(thresholdsRepository.upsertBranch).mockResolvedValue(
      row({ siteId: 'branch-1', reasonRequiredKes: 1500, overnightAlertKes: 300, directorAlertKes: null, updatedById: 'bm1' }) as never,
    );
    const result = await thresholdsService.updateBranch(branchManager as never, { reasonRequiredKes: 1500, overnightAlertKes: 300 });
    expect(thresholdsRepository.upsertBranch).toHaveBeenCalledWith('branch-1', { reasonRequiredKes: 1500, overnightAlertKes: 300, updatedById: 'bm1' });
    expect(result).toMatchObject({ reasonRequiredKes: 1500, overnightAlertKes: 300, directorAlertKes: 5000 });
  });

  it('nobody else can write branch thresholds', async () => {
    const input = { reasonRequiredKes: 1, overnightAlertKes: 1 };
    await expect(thresholdsService.updateBranch(storeManager as never, input)).rejects.toMatchObject({ statusCode: 403 });
    await expect(thresholdsService.updateBranch(director as never, input)).rejects.toMatchObject({ statusCode: 403 });
    await expect(thresholdsService.updateBranch({ ...branchManager, isDepartmentHead: true } as never, input)).rejects.toMatchObject({ statusCode: 403 });
    expect(thresholdsRepository.upsertBranch).not.toHaveBeenCalled();
  });

  it('a Branch Manager cannot send the Director amount or another org; values are bounded', () => {
    expect(UpdateBranchThresholdsSchema.safeParse({ reasonRequiredKes: 1, overnightAlertKes: 1, directorAlertKes: 9 }).success).toBe(false);
    expect(UpdateBranchThresholdsSchema.safeParse({ reasonRequiredKes: 1, overnightAlertKes: 1, siteId: 'x' }).success).toBe(false);
    expect(UpdateBranchThresholdsSchema.safeParse({ reasonRequiredKes: 1 }).success).toBe(false);
    expect(UpdateBranchThresholdsSchema.safeParse({ reasonRequiredKes: -1, overnightAlertKes: 1 }).success).toBe(false);
    expect(UpdateBranchThresholdsSchema.safeParse({ reasonRequiredKes: 0, overnightAlertKes: 1_000_000 }).success).toBe(true);
    // A Store Manager cannot send branch-only fields either.
    expect(UpdateStoreThresholdsSchema.safeParse({ reasonRequiredKes: 1, overnightAlertKes: 1 }).success).toBe(false);
  });
});
