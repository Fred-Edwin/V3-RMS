import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../config/queues', () => ({ notificationQueue: { add: vi.fn() } }));
vi.mock('../../../repositories/auth-repository', () => ({
  authRepository: { findFcmTokensByRole: vi.fn(), findDirectorFcmTokens: vi.fn(), findDepartmentFcmTokens: vi.fn() },
}));
vi.mock('../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('../../../sockets/socket-service', () => ({ socketService: { emitInventoryBadges: vi.fn() } }));
vi.mock('../counting/_shared/count-notify', () => ({ send: vi.fn() }));

import { createNotifier, type Audience, type NotifyDeps, type Notification } from './notify';

const message = { title: 'A list is waiting', body: 'Kitchen has sent.', link: '/x', tag: 't', data: { type: 'x' }, urgency: 'normal' as const };
const BRANCH = '11111111-1111-1111-1111-111111111111';
const HUB = '22222222-2222-2222-2222-222222222222';
const managers: Audience = { kind: 'roles', siteId: BRANCH, roles: ['MANAGER'] };

const harness = (tokens: Record<string, string[]> = {}) => {
  const deps: NotifyDeps = {
    tokensFor: vi.fn(async (a: Audience) => tokens[a.kind === 'roles' ? `roles:${a.siteId}` : a.kind === 'directors' ? 'directors' : 'department'] ?? []),
    push: vi.fn(async (t: string[]) => t.length),
    nudge: vi.fn(),
    hold: vi.fn(async () => undefined),
    log: { info: vi.fn(), warn: vi.fn() },
  };
  return { deps, notifier: createNotifier(deps) };
};

const base = (over: Partial<Notification> = {}): Notification => ({ audiences: [managers], message, badgeSites: [BRANCH], reason: 'requisition.sent', ...over });

// 12:00 Nairobi (09:00Z) is outside quiet hours; 23:30 Nairobi (20:30Z) is inside.
const NOON = new Date('2026-10-08T09:00:00Z');
const NIGHT = new Date('2026-10-08T20:30:00Z');
const EARLY = new Date('2026-10-08T01:00:00Z'); // 04:00 Nairobi

describe('inventory notify layer', () => {
  it('sends the push to the audience tokens and nudges the site room', async () => {
    const { deps, notifier } = harness({ [`roles:${BRANCH}`]: ['tok-1', 'tok-2'] });
    await notifier.send(base(), NOON);
    expect(deps.push).toHaveBeenCalledWith(['tok-1', 'tok-2'], message);
    expect(deps.nudge).toHaveBeenCalledWith(BRANCH, 'requisition.sent');
  });

  it('nudges every named site once, the hub included when it is named', async () => {
    const { deps, notifier } = harness();
    await notifier.send(base({ badgeSites: [BRANCH, HUB, BRANCH] }), NOON);
    expect(deps.nudge).toHaveBeenCalledTimes(2);
    expect(deps.nudge).toHaveBeenCalledWith(HUB, 'requisition.sent');
  });

  it('sends one push per device when two audiences name the same person', async () => {
    const { deps, notifier } = harness({ [`roles:${BRANCH}`]: ['tok-1'], directors: ['tok-1', 'tok-9'] });
    await notifier.send(base({ audiences: [managers, { kind: 'directors' }] }), NOON);
    expect(deps.push).toHaveBeenCalledTimes(1);
    expect(deps.push).toHaveBeenCalledWith(['tok-1', 'tok-9'], message);
  });

  it('sends no push when nobody has a device, but still nudges', async () => {
    const { deps, notifier } = harness();
    await notifier.send(base(), NOON);
    expect(deps.push).not.toHaveBeenCalled();
    expect(deps.nudge).toHaveBeenCalledTimes(1);
  });

  it('a notice with no audience only nudges (the store learns by badge)', async () => {
    const { deps, notifier } = harness();
    await notifier.send(base({ audiences: [], badgeSites: [HUB] }), NOON);
    expect(deps.push).not.toHaveBeenCalled();
    expect(deps.nudge).toHaveBeenCalledWith(HUB, 'requisition.sent');
  });

  describe('quiet hours (22:00 to 05:00 Africa/Nairobi)', () => {
    it('holds a flagged push until 05:00 and still nudges at once', async () => {
      const { deps, notifier } = harness({ directors: ['tok-d'] });
      await notifier.send(base({ audiences: [{ kind: 'directors' }], holdInQuietHours: true }), NIGHT);
      expect(deps.push).not.toHaveBeenCalled();
      expect(deps.nudge).toHaveBeenCalledTimes(1);
      expect(deps.hold).toHaveBeenCalledTimes(1);
      const [notice, runAt] = (deps.hold as ReturnType<typeof vi.fn>).mock.calls[0] as [{ audiences: Audience[] }, Date];
      expect(notice.audiences).toEqual([{ kind: 'directors' }]);
      expect(runAt.toISOString()).toBe('2026-10-09T02:00:00.000Z'); // 05:00 Nairobi next morning
    });

    it('holds a push at 04:00 until 05:00 the same morning', async () => {
      const { deps, notifier } = harness();
      await notifier.send(base({ holdInQuietHours: true }), EARLY);
      const [, runAt] = (deps.hold as ReturnType<typeof vi.fn>).mock.calls[0] as [unknown, Date];
      expect(runAt.toISOString()).toBe('2026-10-08T02:00:00.000Z');
    });

    it('does not hold an unflagged push at night', async () => {
      const { deps, notifier } = harness({ [`roles:${BRANCH}`]: ['tok-1'] });
      await notifier.send(base(), NIGHT);
      expect(deps.hold).not.toHaveBeenCalled();
      expect(deps.push).toHaveBeenCalledTimes(1);
    });

    it('does not hold a flagged push in the daytime', async () => {
      const { deps, notifier } = harness({ [`roles:${BRANCH}`]: ['tok-1'] });
      await notifier.send(base({ holdInQuietHours: true }), NOON);
      expect(deps.hold).not.toHaveBeenCalled();
      expect(deps.push).toHaveBeenCalledTimes(1);
    });

    it('the held job, when it fires, delivers to the audience', async () => {
      const { deps, notifier } = harness({ directors: ['tok-d'] });
      await notifier.dispatchHeld({ audiences: [{ kind: 'directors' }], message, reason: 'x' });
      expect(deps.push).toHaveBeenCalledWith(['tok-d'], message);
    });
  });

  it('never throws: a push failure is logged and the nudge still went', async () => {
    const { deps, notifier } = harness({ [`roles:${BRANCH}`]: ['tok-1'] });
    (deps.push as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fcm down'));
    await expect(notifier.send(base(), NOON)).resolves.toBeUndefined();
    expect(deps.log.warn).toHaveBeenCalled();
    expect(deps.nudge).toHaveBeenCalledTimes(1);
  });

  it('never throws: a failing socket does not stop the push', async () => {
    const { deps, notifier } = harness({ [`roles:${BRANCH}`]: ['tok-1'] });
    (deps.nudge as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('no socket server');
    });
    await expect(notifier.send(base(), NOON)).resolves.toBeUndefined();
    expect(deps.push).toHaveBeenCalledTimes(1);
  });
});
