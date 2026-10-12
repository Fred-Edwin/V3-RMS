import { describe, expect, it, vi } from 'vitest';

vi.mock('../modules/inventory/_shared/notify', () => ({ inventoryNotify: { send: vi.fn() } }));
vi.mock('../modules/inventory/requisitions/requisitions-repository', () => ({ requisitionsRepository: { findDueForEscalation: vi.fn(), claimEscalation: vi.fn() } }));

import type { Notification } from '../modules/inventory/_shared/notify';
import { createEscalator } from './requisition-urgent-escalation';

const NOW = new Date('2026-10-08T10:00:00Z');
const HOUR = 60 * 60 * 1000;
const due = (id: string, extra: Partial<{ urgentNote: string | null }> = {}) => ({ id, siteId: 'site-nyr', reference: `REQ-NYR-${id}`, urgentNote: null, siteName: 'Nyeri Town', ...extra });

const setup = (rows: ReturnType<typeof due>[], claims: Record<string, boolean> = {}) => {
  const sent: Notification[] = [];
  const findDue = vi.fn(async (_cutoff: Date) => rows);
  const claim = vi.fn(async (_site: string, id: string) => claims[id] ?? true);
  const run = createEscalator({ findDue, claim, send: async (n) => void sent.push(n) });
  return { sent, findDue, claim, run };
};

describe('urgent escalation job', () => {
  it('looks for requisitions urgent since one hour ago or earlier', async () => {
    const { findDue, run } = setup([]);
    await run(NOW);
    expect(findDue).toHaveBeenCalledWith(new Date(NOW.getTime() - HOUR));
  });

  it('tells the Directors once per requisition, with a high-urgency push that is not held for quiet hours', async () => {
    const { sent, run } = setup([due('0112', { urgentNote: 'Wedding at 4' })]);
    expect(await run(NOW)).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.audiences).toEqual([{ kind: 'directors' }]);
    expect(sent[0]?.holdInQuietHours).toBeFalsy();
    expect(sent[0]?.message.urgency).toBe('high');
    expect(sent[0]?.message.body).toBe('REQ-NYR-0112 at Nyeri Town has been Urgent and unapproved for over an hour. Wedding at 4');
    expect(sent[0]?.badgeSites).toEqual(['site-nyr']);
  });

  it('is idempotent: a requisition another run already claimed sends nothing', async () => {
    const { sent, run } = setup([due('0112'), due('0113')], { '0112': false });
    expect(await run(NOW)).toBe(1);
    expect(sent.map((s) => s.message.data['requisitionId'])).toEqual(['0113']);
  });

  it('claims with the branch of the record and the same cutoff, so a signed or re-marked requisition cannot be claimed', async () => {
    const { claim, run } = setup([due('0112')]);
    await run(NOW);
    expect(claim).toHaveBeenCalledWith('site-nyr', '0112', new Date(NOW.getTime() - HOUR), NOW);
  });

  it('nothing due, nothing sent', async () => {
    const { sent, run } = setup([]);
    expect(await run(NOW)).toBe(0);
    expect(sent).toHaveLength(0);
  });
});
