import { beforeEach, describe, expect, it, vi } from 'vitest';
import { branchRepository } from '../repositories/branch-repository';
import { locationRepository } from '../repositories/location-repository';
import { branchService } from './branch-service';
import { ConflictError } from '../utils/errors';

vi.mock('../repositories/branch-repository', () => ({
  branchRepository: {
    findById: vi.fn(),
    findHub: vi.fn(),
    setHub: vi.fn(),
  },
}));

vi.mock('../repositories/location-repository', () => ({
  locationRepository: {
    findCentralStore: vi.fn(),
  },
}));

const hubOrgId = '11111111-1111-4111-8111-111111111111';
const otherOrgId = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findById).mockResolvedValue({ id: otherOrgId } as never);
  vi.mocked(branchRepository.setHub).mockResolvedValue({ id: otherOrgId } as never);
});

describe('branchService.setHubBranch — hub is locked once the Central Store exists (D-15)', () => {
  it('refuses to move the hub flag while the Central Store lives on the current hub', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(locationRepository.findCentralStore).mockResolvedValue({
      siteId: hubOrgId,
    } as never);

    await expect(branchService.setHubBranch(otherOrgId)).rejects.toBeInstanceOf(ConflictError);
    expect(branchRepository.setHub).not.toHaveBeenCalled();
  });

  it('allows setting the hub when no Central Store exists yet', async () => {
    vi.mocked(branchRepository.findHub).mockResolvedValue(null);

    await branchService.setHubBranch(otherOrgId);

    expect(branchRepository.setHub).toHaveBeenCalledWith(otherOrgId);
  });

  it('re-flagging the current hub itself is a no-op guard-wise', async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: hubOrgId } as never);
    vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId } as never);

    await branchService.setHubBranch(hubOrgId);

    expect(branchRepository.setHub).toHaveBeenCalledWith(hubOrgId);
  });
});
