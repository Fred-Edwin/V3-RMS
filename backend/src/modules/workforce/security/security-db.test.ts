/** Database proof for phones, alerts, "This wasn't me" and the password reset. Lane database only. */
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);
const T0 = new Date('2026-10-20T08:00:00Z');

describe.skipIf(!enabled)('Security flows in the database', { timeout: 60_000 }, () => {
  const made: string[] = [];
  let siteId: string | null = null;
  const load = async () => {
    const { prisma } = await import('../../../config/database');
    const security = await import('./index');
    const alerts = await import('./alerts/alerts-service');
    const devices = await import('./devices/devices-service');
    const reset = await import('./session/reset-service');
    const unlock = await import('../payslips/unlock/unlock-service');
    const password = await import('../../../utils/password');
    return { prisma, security, alerts, devices, reset, unlock, password };
  };
  const person = async (pin = false) => {
    const { prisma, password } = await load();
    const id = randomUUID();
    made.push(id);
    await prisma.user.create({ data: { id, siteId, name: 'Sec Test', email: `sec-${id}@test.invalid`, role: 'WAITER', isTestUser: true, passwordHash: await password.hashPassword('old-password-1'), ...(pin ? { pinHash: await password.hashPin('1234') } : {}) } });
    return { id, role: 'WAITER' as const, siteId };
  };
  const admin = async () => {
    const { prisma } = await load();
    const a = await prisma.user.findFirstOrThrow({ where: { role: 'SYSTEM_ADMIN', isActive: true } });
    return { id: a.id, role: 'SYSTEM_ADMIN' as const, siteId: null };
  };
  const open = async (userId: string, kind: string) => (await load()).prisma.workforceSecurityAlert.findMany({ where: { subjectUserId: userId, kind } });

  beforeAll(async () => {
    const { prisma } = await load();
    siteId = (await prisma.user.findFirstOrThrow({ where: { email: 'bm.town@wendo.test' } })).siteId;
  });

  afterAll(async () => {
    const { prisma } = await load();
    await prisma.workforceSecurityAlert.deleteMany({ where: { subjectUserId: { in: made } } });
    await prisma.workforceDevice.deleteMany({ where: { userId: { in: made } } });
    await prisma.workforceSecurityFlag.deleteMany({ where: { userId: { in: made } } });
    // payslip_code_tries and the audit log are insert-only by design: the test people stay behind as isTestUser rows.
    await prisma.workforcePinTry.deleteMany({ where: { userId: { in: made } } });
    await prisma.$disconnect();
  });

  it('"This wasn\'t me" ends sessions, clears the code, removes phones, raises one alert, and a second press writes nothing', async () => {
    const { prisma, security, devices } = await load();
    const p = await person(true);
    await prisma.refreshToken.create({ data: { userId: p.id, tokenHash: randomUUID(), expiresAt: new Date(T0.getTime() + 86_400_000) } });
    await devices.phoneSeen(p, { deviceId: 'device-aaaa-1111', label: 'Tecno, Android', placeLabel: 'Nyeri, Kenya' }, T0);
    const first = await security.wasntMe(p, { deviceId: 'device-aaaa-1111', idempotencyKey: 'key-0000-0001' }, { deviceLabel: 'Tecno, Android' }, T0);
    const second = await security.wasntMe(p, { deviceId: 'device-aaaa-1111', idempotencyKey: 'key-0000-0002' }, {}, new Date(T0.getTime() + 1000));
    expect([first.alreadyDone, second.alreadyDone]).toEqual([false, true]);
    expect(await prisma.refreshToken.count({ where: { userId: p.id } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: p.id } })).pinHash).toBeNull();
    expect(await prisma.workforceDevice.count({ where: { userId: p.id, removedAt: null } })).toBe(0);
    const alerts = await open(p.id, 'WASNT_ME');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.auditEntryId).toBeTruthy();
  });

  it('the password reset needs the flag, refuses the old password, and a different one works once', async () => {
    const { reset, security, prisma } = await load();
    const p = await person();
    await expect(reset.resetPassword(p, { newPassword: 'brand-new-pass', confirm: 'brand-new-pass' })).rejects.toMatchObject({ code: 'RESET_NOT_REQUIRED' });
    await security.wasntMe(p, { idempotencyKey: 'key-0000-0003' }, {}, T0);
    expect(await reset.securityState(p)).toEqual({ mustChangePassword: true });
    await expect(reset.resetPassword(p, { newPassword: 'old-password-1', confirm: 'old-password-1' })).rejects.toThrow();
    expect(await reset.resetPassword(p, { newPassword: 'brand-new-pass', confirm: 'brand-new-pass' })).toEqual({ reset: true });
    expect(await reset.securityState(p)).toEqual({ mustChangePassword: false });
    expect((await prisma.workforceSecurityFlag.findUniqueOrThrow({ where: { userId: p.id } })).mustChangePassword).toBe(false);
    expect(reset.resetPasswordSchema.safeParse({ newPassword: 'short', confirm: 'short' }).success).toBe(false);
    expect(reset.resetPasswordSchema.safeParse({ newPassword: 'longenough1', confirm: 'longenough2' }).success).toBe(false);
  });

  it('the gate refuses an old token, a required reset, and a removed phone', async () => {
    const { security, devices, reset } = await load();
    const { signAccessToken } = await import('../../../utils/jwt');
    const p = await person();
    const run = async (token: string, path: string, device?: string) => {
      const req = { headers: { authorization: `Bearer ${token}` }, baseUrl: '/api/v1/workforce', path: path.replace(/^\/workforce/, ''), header: (n: string) => (n.toLowerCase() === 'x-device-id' ? device : undefined) } as unknown as Request;
      let err: unknown = null;
      await security.workforceSessionGate(req, {} as Response, (e?: unknown) => { err = e ?? null; });
      return err as { code?: string } | null;
    };
    const old = signAccessToken({ userId: p.id, role: 'WAITER', siteId: p.siteId });
    expect(await run(old, '/people/me')).toBeNull();
    // a phone that is removed is refused until it is seen again
    await devices.phoneSeen(p, { deviceId: 'device-bbbb-2222', label: 'Tecno, Android', placeLabel: null }, T0);
    const phones = await devices.listPhones(p, null, T0);
    await devices.removePhone(p, phones.phones[0]!.id, 'device-zzzz-9999', T0);
    security.forgetSession(p.id);
    expect(await run(old, '/people/me', 'device-bbbb-2222')).toMatchObject({ code: 'PHONE_REMOVED' });
    expect(await run(old, '/security/phones/me/current/seen', 'device-bbbb-2222')).toBeNull();
    // after the press: a token from before is refused, reset is the only open path
    await new Promise((r) => setTimeout(r, 1100));
    await security.wasntMe(p, { idempotencyKey: 'key-0000-0004' });
    expect(await run(old, '/people/me')).toMatchObject({ code: 'SESSION_ENDED' });
    const fresh = signAccessToken({ userId: p.id, role: 'WAITER', siteId: p.siteId });
    expect(await run(fresh, '/people/me')).toMatchObject({ code: 'PASSWORD_RESET_REQUIRED' });
    expect(await run(fresh, '/security/reset-password')).toBeNull();
    await reset.resetPassword(p, { newPassword: 'another-pass-9', confirm: 'another-pass-9' });
    expect(await run(fresh, '/people/me')).toBeNull();
  });

  it('a phone id of another person is a 404, and "just once" runs out', async () => {
    const { devices } = await load();
    const a = await person();
    const b = await person();
    await devices.phoneSeen(a, { deviceId: 'device-cccc-3333', label: 'Samsung, Android', placeLabel: null }, T0);
    const aPhone = (await devices.listPhones(a, null, T0)).phones[0]!;
    await expect(devices.confirmPhone(b, aPhone.id, null, T0)).rejects.toMatchObject({ code: 'PHONE_NOT_FOUND' });
    await expect(devices.removePhone(b, aPhone.id, null, T0)).rejects.toMatchObject({ code: 'PHONE_NOT_FOUND' });
    await devices.answerCurrentPhone(a, 'device-cccc-3333', 'ONCE', T0);
    expect(await devices.confirmationOf(a.id, 'device-cccc-3333', new Date(T0.getTime() + 3_600_000))).toBe(true);
    expect(await devices.confirmationOf(a.id, 'device-cccc-3333', new Date(T0.getTime() + 13 * 3_600_000))).toBe(false);
    await expect(devices.removePhone(a, aPhone.id, 'device-cccc-3333', T0)).rejects.toMatchObject({ code: 'THIS_PHONE' });
  });

  it('three wrong payslip codes raise one alert for the System Admin, with no amount, and a fourth adds none', async () => {
    const { unlock, alerts } = await load();
    const p = await person(true);
    const wrong = (t: number) => unlock.unlock(p, { code: '9999', deviceId: 'device-dddd-4444' }, 'Tecno, Android', new Date(T0.getTime() + t)).catch((e: { code?: string }) => e.code);
    expect([await wrong(0), await wrong(1000), await wrong(2000)]).toEqual(['CODE_WRONG', 'CODE_WRONG', 'CODE_WRONG']);
    await wrong(3000);
    const rows = await open(p.id, 'WRONG_CODES');
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0])).not.toMatch(/KES|Ksh|amount|\d{4,}\.\d\d/i);
    // clearing: idempotent by key; the second System Admin (a different key) is told who got there first
    const a = await admin();
    const cleared = await alerts.clearAlert(a, rows[0]!.id, { note: 'Rang them, it was a slip.', idempotencyKey: 'clear-key-0001' });
    const again = await alerts.clearAlert(a, rows[0]!.id, { note: 'Rang them, it was a slip.', idempotencyKey: 'clear-key-0001' });
    expect([cleared.status, again.status]).toEqual(['CLEARED', 'CLEARED']);
    await expect(alerts.clearAlert(a, rows[0]!.id, { note: 'Second admin here', idempotencyKey: 'clear-key-0002' })).rejects.toMatchObject({ code: 'ALREADY_CLEARED' });
  });
});
