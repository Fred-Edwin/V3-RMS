import { describe, expect, it, vi } from 'vitest';

vi.mock('../../_shared/notify', () => ({ inventoryNotify: { send: vi.fn() } }));

import type { Notification } from '../../_shared/notify';
import { createPurchasingNotices, orderLink } from './purchasing-notify';

const HUB = 'hub-1';
const base = { hubId: HUB, orderId: 'o1', reference: 'LPO-0045', supplierName: 'Kagumo Poultry Farm' };

const harness = () => {
  const sent: Notification[] = [];
  return { sent, notices: createPurchasingNotices({ send: async (n) => void sent.push(n) }) };
};

describe('the Purchasing rows of the notification map', () => {
  it('row 22: tells the person who raised the order, naming the approver with their role, and opens the order', async () => {
    const { sent, notices } = harness();
    await notices.approved({ ...base, raisedById: 'att', approverLabel: 'Joseph (Store Manager)' });
    expect(sent[0]).toMatchObject({
      audiences: [{ kind: 'users', userIds: ['att'] }],
      badgeSites: [HUB],
      reason: 'purchasing.approved',
      message: { title: 'Order approved', body: 'Joseph (Store Manager) approved LPO-0045 to Kagumo Poultry Farm. Ready to send.', link: orderLink('o1'), data: { type: 'purchasing_approved', orderId: 'o1' } },
    });
  });

  it('row 23: tells the raiser with the note, as a high-urgency push', async () => {
    const { sent, notices } = harness();
    await notices.returned({ ...base, raisedById: 'att', returnerLabel: 'Joseph (Store Manager)', note: 'Lower the carrots to 5 sacks.' });
    expect(sent[0]?.message).toMatchObject({ title: 'Order sent back', body: 'Joseph (Store Manager) sent LPO-0045 back: "Lower the carrots to 5 sacks."', urgency: 'high' });
    expect(sent[0]?.audiences).toEqual([{ kind: 'users', userIds: ['att'] }]);
  });

  it('row 26: tells the raiser the order is closed with no figure in it', async () => {
    const { sent, notices } = harness();
    await notices.closed({ ...base, raisedById: 'att' });
    expect(sent[0]?.message.body).toBe('LPO-0045 to Kagumo Poultry Farm is paid in full.');
    expect(JSON.stringify(sent[0])).not.toMatch(/KES|invoice|balance|amount/i);
  });

  it('row 27: reminds the hub’s Store Manager, naming who is waiting with their role', async () => {
    const { sent, notices } = harness();
    await notices.reminder({ ...base, fromLabel: 'Amina (Store Attendant)' });
    expect(sent[0]).toMatchObject({ audiences: [{ kind: 'roles', siteId: HUB, roles: ['STORE_MANAGER'] }], message: { title: 'An order is waiting for you' } });
    expect(sent[0]?.message.body).toBe('Amina (Store Attendant) is waiting for you to approve LPO-0045 to Kagumo Poultry Farm.');
  });

  it('rows 24 and 25: tell the hub’s Store Attendants about a delivery due today and one that is late', async () => {
    const { sent, notices } = harness();
    await notices.dueToday({ ...base, itemCount: 4 });
    await notices.overdue({ ...base, daysLate: 1 });
    await notices.overdue({ ...base, daysLate: 3 });
    expect(sent.map((n) => n.audiences)).toEqual(Array(3).fill([{ kind: 'roles', siteId: HUB, roles: ['STORE_ATTENDANT'] }]));
    expect(sent[0]?.message).toMatchObject({ title: 'Delivery due today', body: 'Kagumo Poultry Farm is due to deliver LPO-0045 (4 items).' });
    expect(sent[1]?.message).toMatchObject({ title: '1 day overdue', urgency: 'high' });
    expect(sent[2]?.message.title).toBe('3 days overdue');
  });

  it('row 21b: nudges the hub’s open screens and pushes nobody when an order is sent for approval', async () => {
    const { sent, notices } = harness();
    await notices.submitted(base);
    expect(sent[0]).toMatchObject({ audiences: [], badgeSites: [HUB], reason: 'purchasing.submitted' });
  });

  it('uses one tag per order and kind, so a repeat replaces the earlier push on the phone', async () => {
    const { sent, notices } = harness();
    await notices.dueToday({ ...base, itemCount: 1 });
    expect(sent[0]?.message.tag).toBe('purchasing-due-o1');
  });
});
