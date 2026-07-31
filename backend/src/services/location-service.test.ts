import { beforeEach, describe, expect, it, vi } from 'vitest';
import { locationRepository } from '../repositories/location-repository';
import { branchRepository } from '../repositories/branch-repository';
import { locationService } from './location-service';
import { ConflictError, ValidationError } from '../utils/errors';

vi.mock('../repositories/location-repository', () => ({
  locationRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    findCentralStore: vi.fn(),
    createCentralStore: vi.fn(),
  },
}));

vi.mock('../repositories/branch-repository', () => ({
  branchRepository: {
    findHub: vi.fn(),
  },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const branchOrgId = '22222222-2222-4222-8222-222222222222';
const locationId = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('locationService.createCentralStore (design doc D-15)', () => {
  it('creates the location under the hub org, never a caller-chosen org', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue(null);
    vi.mocked(locationRepository.createCentralStore).mockResolvedValue({
      id: locationId,
      organizationId: hubOrgId,
    } as never);

    const created = await locationService.createCentralStore('Central Store');

    expect(locationRepository.createCentralStore).toHaveBeenCalledWith(hubOrgId, 'Central Store');
    expect(created.organizationId).toBe(hubOrgId);
  });

  it('rejects when no hub organization is flagged', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue(null);

    await expect(locationService.createCentralStore('Central Store')).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(locationRepository.createCentralStore).not.toHaveBeenCalled();
  });

  it('rejects when a Central Store already exists — even on another org', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue({
      id: locationId,
      organizationId: branchOrgId,
    } as never);

    await expect(locationService.createCentralStore('Central Store')).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(locationRepository.createCentralStore).not.toHaveBeenCalled();
  });
});
