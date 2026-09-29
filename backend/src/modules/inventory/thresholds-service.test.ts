/**
 * Thresholds (plan §1.9, §4.5): defaults with no row, role-chosen write
 * schemas, only DIRECTOR sets the company-wide amount, the SM write never
 * touches it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { thresholdsService } from './thresholds-service';
import { thresholdsRepository } from './thresholds-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { UpdateDirectorThresholdSchema, UpdateStoreThresholdsSchema } from './thresholds-validators';
import { hubOrgId, storeManager } from './count-test-fixtures';

vi.mock('./thresholds-repository', () => ({
  thresholdsRepository: { findByOrganization: vi.fn(), upsertStoreReason: vi.fn(), upsertDirectorAlert: vi.fn() },
}));
vi.mock('../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));

const director = { id: 'd1', role: 'DIRECTOR' as const, organizationId: null };
const branchManager = { id: 'bm1', role: 'MANAGER' as const, organizationId: 'branch-1' };
const row = (over = {}) => ({
  id: 't1',
  organizationId: hubOrgId,
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
    vi.mocked(thresholdsRepository.findByOrganization).mockResolvedValue(null);
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
    vi.mocked(thresholdsRepository.findByOrganization).mockResolvedValue(row() as never);
    expect(await thresholdsService.get(storeManager)).toMatchObject({
      reasonRequiredKes: 800,
      isDefault: false,
      updatedBy: { name: 'Joseph Mwangi' },
      updatedAt: '2026-09-10T08:00:00.000Z',
    });
  });

  it('the Store Manager write keeps the Director amount', async () => {
    vi.mocked(thresholdsRepository.findByOrganization).mockResolvedValue(row({ directorAlertKes: 7500 }) as never);
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
    vi.mocked(thresholdsRepository.findByOrganization).mockResolvedValue(null);
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

  it('a Store Manager write is refused for anyone else, and a branch manager cannot write at all yet', async () => {
    await expect(thresholdsService.updateStore(branchManager as never, { reasonRequiredKes: 1 })).rejects.toMatchObject({ statusCode: 403 });
    await expect(thresholdsService.updateStore({ ...storeManager, organizationId: 'x' }, { reasonRequiredKes: 1 })).rejects.toMatchObject({ statusCode: 403 });
  });
});
