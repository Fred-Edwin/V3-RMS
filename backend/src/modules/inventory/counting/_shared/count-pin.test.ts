import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countPin } from './count-pin';
import { countPinRepository } from './pin-repository';
import { comparePin } from '../../../../utils/password';

vi.mock('./pin-repository', () => ({ countPinRepository: { findHolder: vi.fn() } }));
vi.mock('../../../../utils/password', () => ({ comparePin: vi.fn() }));

const actor = { id: 'u1', role: 'STORE_MANAGER' as const, siteId: 'hub' } as never;
const holder = { id: 'u1', name: 'Isabel', role: 'STORE_MANAGER' as const, pinHash: 'hash' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('countPin.verifyOwn', () => {
  it('returns the holder when the caller’s own PIN matches', async () => {
    vi.mocked(countPinRepository.findHolder).mockResolvedValue(holder);
    vi.mocked(comparePin).mockResolvedValue(true);
    await expect(countPin.verifyOwn(actor, '1234')).resolves.toBe(holder);
    expect(countPinRepository.findHolder).toHaveBeenCalledWith('u1');
    expect(comparePin).toHaveBeenCalledWith('1234', 'hash');
  });

  it('refuses a wrong PIN, a missing PIN and an unknown person with the same INVALID_PIN', async () => {
    vi.mocked(countPinRepository.findHolder).mockResolvedValue(holder);
    vi.mocked(comparePin).mockResolvedValue(false);
    const wrong = await countPin.verifyOwn(actor, '0000').catch((e) => e);

    vi.mocked(countPinRepository.findHolder).mockResolvedValue({ ...holder, pinHash: null });
    const missing = await countPin.verifyOwn(actor, '1234').catch((e) => e);

    vi.mocked(countPinRepository.findHolder).mockResolvedValue(null);
    const unknown = await countPin.verifyOwn(actor, '1234').catch((e) => e);

    for (const error of [wrong, missing, unknown]) {
      expect(error).toMatchObject({ statusCode: 401, code: 'INVALID_PIN', message: wrong.message });
    }
  });

  it('the System Admin signs with their own PIN, never anyone else’s', async () => {
    const admin = { id: 'admin1', role: 'SYSTEM_ADMIN' as const, siteId: null } as never;
    vi.mocked(countPinRepository.findHolder).mockResolvedValue({ ...holder, id: 'admin1', role: 'SYSTEM_ADMIN' });
    vi.mocked(comparePin).mockResolvedValue(true);
    await countPin.verifyOwn(admin, '1234');
    expect(countPinRepository.findHolder).toHaveBeenCalledWith('admin1');
  });
});
