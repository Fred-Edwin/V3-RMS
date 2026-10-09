import { describe, expect, it, vi } from 'vitest';
import { createWaitingNotifier } from './inventory-delivery-jobs';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const due = (id: string) => ({ id, reference: `DSP-NYR-000${id}`, toSiteId: 'branch-1', department: { name: 'Pastry' } });

describe('the 2-hour "Waiting for the branch" job', () => {
  it('looks 2 hours back from signedAt, claims each delivery once and tells the Branch Manager once', async () => {
    const findDue = vi.fn().mockResolvedValue([due('1'), due('2')]);
    const claim = vi.fn().mockResolvedValue(true);
    const notify = vi.fn().mockResolvedValue(undefined);
    const run = createWaitingNotifier({ hubId: async () => 'hub', findDue, claim, notify });
    expect(await run(NOW)).toBe(2);
    expect(findDue).toHaveBeenCalledWith('hub', new Date('2026-10-09T10:00:00.000Z'));
    expect(notify).toHaveBeenCalledWith({ hubId: 'hub', branchId: 'branch-1', dispatchId: '1', reference: 'DSP-NYR-0001', departmentName: 'Pastry' });
  });
  it('is idempotent: a delivery another run already claimed is not told again', async () => {
    const claimed = new Set<string>();
    const claim = vi.fn(async (id: string) => (claimed.has(id) ? false : (claimed.add(id), true)));
    const notify = vi.fn().mockResolvedValue(undefined);
    const run = createWaitingNotifier({ hubId: async () => 'hub', findDue: async () => [due('1')], claim, notify });
    expect(await run(NOW)).toBe(1);
    expect(await run(NOW)).toBe(0);
    expect(await Promise.all([run(NOW), run(NOW)])).toEqual([0, 0]);
    expect(notify).toHaveBeenCalledTimes(1);
  });
  it('does nothing without a hub', async () => {
    const findDue = vi.fn();
    expect(await createWaitingNotifier({ hubId: async () => null, findDue, claim: vi.fn(), notify: vi.fn() })(NOW)).toBe(0);
    expect(findDue).not.toHaveBeenCalled();
  });
});
