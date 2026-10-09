import { describe, expect, it, vi } from 'vitest';
import type { Notification } from '../_shared/notify';
import { createDiscrepancyNotices } from '../discrepancies/discrepancies-notify';
import { createBranchNotices, gapSentence, type BranchNoticeDeps } from './deliveries-notify';

const deps = () => {
  const sent: Notification[] = [];
  const dispatchEvents: unknown[] = [];
  const discrepancyEvents: unknown[] = [];
  const d: BranchNoticeDeps = {
    send: async (n) => void sent.push(n),
    emitDispatchChanged: (_hub, p) => void dispatchEvents.push(p),
    emitDiscrepancyChanged: (_hub, p) => void discrepancyEvents.push(p),
  };
  return { d, sent, dispatchEvents, discrepancyEvents };
};
const gap = { id: 'd1', reference: 'DSC-NYR-0007', itemName: 'Milk 1L', gapQty: '-2' };
const batch = { hubId: 'hub', branchId: 'branch', branchName: 'Nyeri Town', dispatchId: 'p1', dispatchReference: 'DSP-NYR-0232', departmentName: 'Pastry', discrepancies: [gap] };

describe('map row 17: a delivery gap is opened', () => {
  it('uses the drawn wording', () => {
    expect(gapSentence(gap, 'Nyeri Town')).toBe('Milk 1L is short by 2 at Nyeri Town (DSC-NYR-0007).');
    expect(gapSentence({ ...gap, gapQty: '2' }, 'Nyeri Town')).toBe('Milk 1L has 2 extra at Nyeri Town (DSC-NYR-0007).');
  });
  it('tells the Store Manager and the Director by push, nudges both badges, and emits both events', async () => {
    const t = deps();
    await createBranchNotices(t.d).confirmed(batch);
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]?.audiences).toEqual([{ kind: 'roles', siteId: 'hub', roles: ['STORE_MANAGER'] }, { kind: 'directors' }]);
    expect(t.sent[0]?.badgeSites).toEqual(['branch', 'hub']);
    expect(t.sent[0]?.holdInQuietHours).toBeUndefined();
    expect(t.sent[0]?.message.body).toBe('Milk 1L is short by 2 at Nyeri Town (DSC-NYR-0007).');
    expect(t.sent[0]?.message.link).toBe('/app/inventory/discrepancies/d1');
    expect(t.discrepancyEvents).toHaveLength(1);
    expect(t.dispatchEvents).toHaveLength(1);
  });
  it('several differing lines make one push about the delivery, with no person named', async () => {
    const t = deps();
    await createBranchNotices(t.d).confirmed({ ...batch, discrepancies: [gap, { ...gap, id: 'd2', reference: 'DSC-NYR-0008' }] });
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]?.message.body).toBe("2 lines of Pastry's delivery are different at Nyeri Town (DSP-NYR-0232).");
    expect(t.discrepancyEvents).toHaveLength(2);
  });
  it('a clean delivery pushes nobody; the badges still move', async () => {
    const t = deps();
    await createBranchNotices(t.d).confirmed({ ...batch, discrepancies: [] });
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]?.audiences).toEqual([]);
    expect(t.sent[0]?.badgeSites).toEqual(['branch', 'hub']);
  });
  it('a socket that throws never fails the write', async () => {
    const t = deps();
    t.d.emitDispatchChanged = vi.fn(() => {
      throw new Error('socket down');
    });
    await expect(createBranchNotices(t.d).confirmed(batch)).resolves.toBeUndefined();
    expect(t.sent).toHaveLength(1);
  });
});

describe('map row 20: waiting for the branch', () => {
  it('pushes the Branch Manager of that branch only, urgently, with the drawn wording', async () => {
    const t = deps();
    await createBranchNotices(t.d).waiting({ hubId: 'hub', branchId: 'branch', dispatchId: 'p1', reference: 'DSP-NYR-0232', departmentName: 'Pastry' });
    expect(t.sent[0]?.audiences).toEqual([{ kind: 'roles', siteId: 'branch', roles: ['MANAGER'] }]);
    expect(t.sent[0]?.message.body).toContain('Nobody in Pastry has counted DSP-NYR-0232 yet.');
    expect(t.sent[0]?.message.urgency).toBe('high');
  });
});

describe('map rows 17, 18 and 19: findings and the reminder', () => {
  const finding = { hubId: 'hub', branchId: 'branch', discrepancyId: 'd1', reference: 'DSC-NYR-0007', dispatchId: 'p1', dispatchReference: 'DSP-NYR-0232' };
  it('a loss tells the Director and the Accountant, with the value', async () => {
    const t = deps();
    await createDiscrepancyNotices(t.d).recorded({ ...finding, finding: 'LOST_OR_DAMAGED', lossValueKes: '480.00' });
    expect(t.sent.map((n) => n.audiences)).toEqual([[{ kind: 'directors' }], [{ kind: 'roles', siteId: 'hub', roles: ['ACCOUNTANT'] }]]);
    expect(t.sent[0]?.message.body).toBe('A finding was recorded on DSC-NYR-0007: lost or damaged on the way.');
    expect(t.sent[1]?.message.body).toBe('KES 480 written off: lost or damaged on the way (DSC-NYR-0007).');
    expect(t.discrepancyEvents).toHaveLength(1);
  });
  it('a finding that writes nothing off does not tell the Accountant', async () => {
    const t = deps();
    await createDiscrepancyNotices(t.d).recorded({ ...finding, finding: 'PACKED_SHORT', lossValueKes: null });
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]?.audiences).toEqual([{ kind: 'directors' }]);
  });
  it('a reversal tells the Director and nobody else', async () => {
    const t = deps();
    await createDiscrepancyNotices(t.d).reversed({ ...finding, finding: 'LOST_OR_DAMAGED', lossValueKes: null });
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]?.audiences).toEqual([{ kind: 'directors' }]);
  });
  it('the reminder goes to the Store Manager only, and says how long it has waited', async () => {
    const t = deps();
    await createDiscrepancyNotices(t.d).reminder({ hubId: 'hub', discrepancyId: 'd1', reference: 'DSC-KRT-0003', hours: 24.5 });
    await createDiscrepancyNotices(t.d).reminder({ hubId: 'hub', discrepancyId: 'd1', reference: 'DSC-KRT-0003', hours: 73 });
    expect(t.sent.map((n) => n.audiences)).toEqual([[{ kind: 'roles', siteId: 'hub', roles: ['STORE_MANAGER'] }], [{ kind: 'roles', siteId: 'hub', roles: ['STORE_MANAGER'] }]]);
    expect(t.sent[0]?.message.body).toBe('DSC-KRT-0003 has waited 24 hours for a finding.');
    expect(t.sent[1]?.message.body).toBe('DSC-KRT-0003 has waited 3 days for a finding.');
    expect(t.sent[0]?.message.tag).not.toBe(t.sent[1]?.message.tag);
  });
  it('no notice names a person, and none is held for quiet hours', async () => {
    const t = deps();
    await createDiscrepancyNotices(t.d).recorded({ ...finding, finding: 'CANT_TELL', lossValueKes: '10.00' });
    await createBranchNotices(t.d).confirmed(batch);
    for (const n of t.sent) expect(n.holdInQuietHours).toBeUndefined();
  });
});
