import { describe, expect, it, vi } from 'vitest';

vi.mock('../_shared/notify', () => ({ findHubSiteId: vi.fn(), inventoryNotify: { send: vi.fn() } }));
vi.mock('./requisitions-list-repository', () => ({ requisitionsListRepository: { listSectionDepartmentIds: vi.fn() } }));

import type { Notification } from '../_shared/notify';
import type { RequisitionNotice } from './requisitions-events';
import { createNoticeHandler } from './requisitions-notices';

const SITE = 'site-nyr';
const HUB = 'hub-1';
const base = { requisitionId: 'req-1', reference: 'REQ-NYR-0112', siteId: SITE, actorId: 'u1' } as const;

const run = async (notice: RequisitionNotice, departments: string[] = ['dept-k', 'dept-b'], hub: string | null = HUB) => {
  const sent: Notification[] = [];
  const departmentIds = vi.fn(async () => departments);
  await createNoticeHandler({ send: async (n) => void sent.push(n), departmentIds, hubSiteId: async () => hub })(notice);
  return { sent, departmentIds };
};

describe('requisition notices -> the notification layer (map rows 1, 2, 3, 4, 13)', () => {
  it('row 1: a head sent -> the Branch Manager hears, the branch badge nudges', async () => {
    const { sent } = await run({ ...base, type: 'SECTION_SENT', departmentId: 'dept-k', departmentName: 'Kitchen', readyToApprove: false });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.audiences).toEqual([{ kind: 'roles', siteId: SITE, roles: ['MANAGER'] }]);
    expect(sent[0]?.badgeSites).toEqual([SITE]);
    expect(sent[0]?.message.title).toBe('A list is waiting');
    expect(sent[0]?.message.body).toContain('Kitchen');
    expect(sent[0]?.holdInQuietHours).toBeFalsy();
  });

  it('row 1: the last list in says Ready to approve', async () => {
    const { sent } = await run({ ...base, type: 'SECTION_SENT', departmentId: 'dept-k', departmentName: 'Kitchen', readyToApprove: true });
    expect(sent[0]?.message.title).toBe('Ready to approve');
  });

  it('row 1 on behalf: the head is told, not the manager who did it', async () => {
    const { sent } = await run({ ...base, type: 'SECTION_SENT', departmentId: 'dept-k', departmentName: 'Kitchen', readyToApprove: false, onBehalf: true });
    expect(sent[0]?.audiences).toEqual([{ kind: 'department', siteId: SITE, departmentIds: ['dept-k'], headsOnly: true }]);
    expect(sent[0]?.message.title).toBe('Your list was sent');
  });

  it('filling on behalf tells the head, with one tag per department so repeated saves replace each other', async () => {
    const a = await run({ ...base, type: 'SECTION_EDITED_ON_BEHALF', departmentId: 'dept-k', departmentName: 'Kitchen' });
    const b = await run({ ...base, type: 'SECTION_EDITED_ON_BEHALF', departmentId: 'dept-k', departmentName: 'Kitchen' });
    expect(a.sent[0]?.audiences).toEqual([{ kind: 'department', siteId: SITE, departmentIds: ['dept-k'], headsOnly: true }]);
    expect(a.sent[0]?.message.tag).toBe(b.sent[0]?.message.tag);
  });

  it('row 2: a quantity change tells the head of that department what changed', async () => {
    const { sent } = await run({ ...base, type: 'QUANTITY_CHANGED', departmentId: 'dept-k', departmentName: 'Kitchen', itemName: 'Milk', from: '30', to: '24', reason: 'Short in store' });
    expect(sent[0]?.audiences).toEqual([{ kind: 'department', siteId: SITE, departmentIds: ['dept-k'], headsOnly: true }]);
    expect(sent[0]?.message.body).toBe('Milk on REQ-NYR-0112: 30 to 24 · Short in store');
  });

  it('row 3: Urgent tells the Branch Manager at once with a high-urgency push (the Director waits for the hour)', async () => {
    const { sent } = await run({ ...base, type: 'URGENT_SET' });
    expect(sent[0]?.audiences).toEqual([{ kind: 'roles', siteId: SITE, roles: ['MANAGER'] }]);
    expect(sent[0]?.message.urgency).toBe('high');
    expect(sent[0]?.audiences.some((a) => a.kind === 'directors')).toBe(false);
  });

  it('row 4: approved -> the heads whose lists were in hear; the store gets the badge only (hub room), no push', async () => {
    const { sent, departmentIds } = await run({ ...base, type: 'APPROVED', signedAs: 'BRANCH_MANAGER' });
    expect(departmentIds).toHaveBeenCalledWith('req-1', SITE, true);
    expect(sent[0]?.audiences).toEqual([{ kind: 'department', siteId: SITE, departmentIds: ['dept-k', 'dept-b'], headsOnly: true }]);
    expect(sent[0]?.badgeSites).toEqual([SITE, HUB]);
    expect(sent[0]?.audiences.some((a) => a.kind === 'roles' && a.siteId === HUB)).toBe(false);
  });

  it('row 4: when the Director signs, the Branch Manager is told too', async () => {
    const { sent } = await run({ ...base, type: 'APPROVED', signedAs: 'DIRECTOR' });
    expect(sent[0]?.audiences).toContainEqual({ kind: 'roles', siteId: SITE, roles: ['MANAGER'] });
  });

  it('row 4 without a hub configured still tells the branch', async () => {
    const { sent } = await run({ ...base, type: 'APPROVED', signedAs: 'BRANCH_MANAGER' }, ['dept-k'], null);
    expect(sent[0]?.badgeSites).toEqual([SITE]);
  });

  it('row 13: cancelled -> every head whose list was not skipped hears, with the reason', async () => {
    const { sent, departmentIds } = await run({ ...base, type: 'CANCELLED', reason: 'No longer needed' });
    expect(departmentIds).toHaveBeenCalledWith('req-1', SITE, false);
    expect(sent[0]?.message.body).toBe('REQ-NYR-0112 was cancelled · No longer needed');
    expect(sent[0]?.badgeSites).toEqual([SITE, HUB]);
  });

  it('nudge tells the head; an addition tells the manager; an approved addition tells the head', async () => {
    const nudge = await run({ ...base, type: 'NUDGED', departmentId: 'dept-b', departmentName: 'Barista' });
    expect(nudge.sent[0]?.audiences).toEqual([{ kind: 'department', siteId: SITE, departmentIds: ['dept-b'], headsOnly: true }]);
    const added = await run({ ...base, type: 'ADDITION_ADDED', additionId: 'a1', departmentId: 'dept-k', departmentName: 'Kitchen' });
    expect(added.sent[0]?.audiences).toEqual([{ kind: 'roles', siteId: SITE, roles: ['MANAGER'] }]);
    const approved = await run({ ...base, type: 'ADDITION_APPROVED', additionId: 'a1', departmentId: 'dept-k', departmentName: 'Kitchen' });
    expect(approved.sent[0]?.audiences).toEqual([{ kind: 'department', siteId: SITE, departmentIds: ['dept-k'], headsOnly: true }]);
  });

  it('every notice names the site it happened at, and no push carries a person\'s name or a PIN', async () => {
    const notices: RequisitionNotice[] = [
      { ...base, type: 'SECTION_SENT', departmentId: 'dept-k', departmentName: 'Kitchen', readyToApprove: false },
      { ...base, type: 'QUANTITY_CHANGED', departmentId: 'dept-k', departmentName: 'Kitchen', itemName: 'Milk', from: '3', to: '2', reason: null },
      { ...base, type: 'URGENT_SET' },
      { ...base, type: 'APPROVED', signedAs: 'DIRECTOR' },
      { ...base, type: 'CANCELLED', reason: 'No longer needed' },
    ];
    for (const n of notices) {
      const { sent } = await run(n);
      for (const s of sent) {
        expect(s.badgeSites).toContain(SITE);
        expect(s.message.link).toBe('/app/branch/requisitions/req-1');
        expect(JSON.stringify(s.message)).not.toMatch(/\bpin\b|actorId|u1/i);
      }
    }
  });
});
