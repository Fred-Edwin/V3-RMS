import { describe, expect, it, vi } from 'vitest';
import { alertMessage, alertSchedule, createCountNotifier, submitMessage, type CountNotifierDeps, type DirectorAlertJob } from './count-notify';

vi.mock('../../../../config/queues', () => ({ notificationQueue: { add: vi.fn() } }));
vi.mock('../../../../config/firebase', () => ({ firebaseMessaging: null }));
vi.mock('../../../../repositories/auth-repository', () => ({ authRepository: { findFcmTokensByRole: vi.fn(), findDirectorFcmTokens: vi.fn() } }));

const at = (iso: string) => new Date(iso);

const deps = (overrides: Partial<CountNotifierDeps> = {}): CountNotifierDeps => ({
  sendToStoreManagers: vi.fn().mockResolvedValue(1),
  sendToDirectors: vi.fn().mockResolvedValue(2),
  scheduleDirectorAlert: vi.fn().mockResolvedValue(undefined),
  log: { info: vi.fn(), warn: vi.fn() },
  ...overrides,
});

const job = (lines: DirectorAlertJob['lines']): DirectorAlertJob => ({ countId: 'c1', reference: 'CNT-2026-0015', signerName: 'Isabel Njoki', alertKes: 5000, lines });

describe('the words', () => {
  it('the submit push names the counter and the number counted', () => {
    expect(submitMessage({ countId: 'c1', reference: 'CNT-2026-0007', counterName: 'Linnet Wanjiru', itemsCounted: 36 })).toMatchObject({
      body: 'Linnet submitted CNT-2026-0007 · 36 items counted',
      link: '/app/inventory/stock/counts',
      tag: 'count-submitted-c1',
    });
    expect(submitMessage({ countId: 'c1', reference: 'CNT-2026-0007', counterName: 'Linnet Wanjiru', itemsCounted: 1 }).body).toMatch(/1 item counted/);
  });

  it('the alert push for one line is the Paper step 46 sentence, and opens the flagged list', () => {
    expect(alertMessage(job([{ itemName: 'Eggs', valueKes: -5200 }]))).toMatchObject({
      body: 'Isabel signed a count: Eggs short KES 5,200. Over your KES 5,000 alert. Tap to open it',
      link: '/app/inventory/stock/counts?view=flagged',
      urgency: 'high',
    });
  });

  it('an over-count is "over", and several lines name the largest', () => {
    expect(alertMessage(job([{ itemName: 'Sugar', valueKes: 6100 }])).body).toContain('Sugar over KES 6,100');
    expect(alertMessage(job([{ itemName: 'Eggs', valueKes: -5200 }, { itemName: 'Oil', valueKes: -9000 }, { itemName: 'Tea', valueKes: 5000 }])).body).toBe(
      'Isabel signed a count: 3 lines are over your KES 5,000 alert, the largest Oil short KES 9,000. Tap to open it',
    );
  });
});

describe('quiet hours 22:00 to 05:00 Africa/Nairobi, with a fixed clock', () => {
  it('awake: sends now', () => {
    expect(alertSchedule(at('2026-10-13T09:00:00Z')).sendNow).toBe(true); // noon
    expect(alertSchedule(at('2026-10-14T02:00:00Z')).sendNow).toBe(true); // 05:00 sharp
  });
  it('quiet: held until 05:00', () => {
    const late = alertSchedule(at('2026-10-13T19:30:00Z')); // 22:30
    expect(late.sendNow).toBe(false);
    expect(late.runAt.toISOString()).toBe('2026-10-14T02:00:00.000Z');
    const small = alertSchedule(at('2026-10-14T00:10:00Z')); // 03:10
    expect(small.runAt.toISOString()).toBe('2026-10-14T02:00:00.000Z');
  });
});

describe('the notifier', () => {
  it('a submit goes to the Store Manager of the hub', async () => {
    const d = deps();
    await createCountNotifier(d).submitted('hub', { countId: 'c1', reference: 'CNT-2026-0007', counterName: 'Linnet Wanjiru', itemsCounted: 36 });
    expect(d.sendToStoreManagers).toHaveBeenCalledWith('hub', expect.objectContaining({ tag: 'count-submitted-c1' }));
    expect(d.log.info).toHaveBeenCalledWith(expect.objectContaining({ recipients: 1 }), 'Count submitted push sent');
  });

  it('an alert in the daytime goes out at once', async () => {
    const d = deps();
    await createCountNotifier(d).directorAlert(job([{ itemName: 'Eggs', valueKes: -5200 }]), at('2026-10-13T09:00:00Z'));
    expect(d.sendToDirectors).toHaveBeenCalledTimes(1);
    expect(d.scheduleDirectorAlert).not.toHaveBeenCalled();
  });

  it('an alert at 23:00 is held, not sent, and scheduled for 05:00 with the same job', async () => {
    const d = deps();
    const held = job([{ itemName: 'Eggs', valueKes: -5200 }]);
    const now = at('2026-10-13T20:00:00Z');
    await createCountNotifier(d).directorAlert(held, now);
    expect(d.sendToDirectors).not.toHaveBeenCalled();
    expect(d.scheduleDirectorAlert).toHaveBeenCalledWith(held, at('2026-10-14T02:00:00Z'), now);
  });

  it('no alerting line means no push at all', async () => {
    const d = deps();
    await createCountNotifier(d).directorAlert(job([]), at('2026-10-13T09:00:00Z'));
    expect(d.sendToDirectors).not.toHaveBeenCalled();
    expect(d.scheduleDirectorAlert).not.toHaveBeenCalled();
  });

  it('the held job, when it fires, sends the same alert', async () => {
    const d = deps();
    await createCountNotifier(d).dispatchDirectorAlertJob(job([{ itemName: 'Eggs', valueKes: -5200 }]));
    expect(d.sendToDirectors).toHaveBeenCalledWith(expect.objectContaining({ tag: 'count-director-alert-c1' }));
  });

  it('a failing push is logged and never thrown (a count must not fail on a push)', async () => {
    const d = deps({ sendToStoreManagers: vi.fn().mockRejectedValue(new Error('fcm down')), sendToDirectors: vi.fn().mockRejectedValue(new Error('fcm down')) });
    const notifier = createCountNotifier(d);
    await expect(notifier.submitted('hub', { countId: 'c1', reference: 'R', counterName: 'A B', itemsCounted: 1 })).resolves.toBeUndefined();
    await expect(notifier.directorAlert(job([{ itemName: 'Eggs', valueKes: -5200 }]), at('2026-10-13T09:00:00Z'))).resolves.toBeUndefined();
    await expect(notifier.dispatchDirectorAlertJob(job([{ itemName: 'Eggs', valueKes: -5200 }]))).resolves.toBeUndefined();
    expect(d.log.warn).toHaveBeenCalledTimes(3);
  });
});
