/**
 * Conduct against a real database, in the order a pilot branch lives it (Segment 5): a switched-off branch cannot issue; a manager
 * issues a written warning (the same key twice is one notice); who may read it and who may not (404 versus 403); the person signs
 * with their code (twice is one signature); the letter is a PDF, stored once the receipt is final, and opening it as a manager is
 * audited while the person's own read is not; the person appeals; HR reduces it (a new linked verbal note, the old letter gains a
 * decision page as version 2); two deciders at once leave one winner; the nightly sweep ends what has run out; the old HR screen is
 * refused for a switched site and allowed for a switched-off one; the notices repository has no delete.
 *
 * Runs only when DATABASE_URL names a lane database. It removes what it makes and puts PINs and the switch back; the audit entries
 * stay (the log is append-only by design). Run the workforce database flows one file at a time.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('Conduct flows in the database', () => {
  type Subject = import('../_shared/workforce-access').AccessSubject;
  const tag = randomUUID().slice(0, 8);
  const load = async () => ({
    ...(await import('../../../config/database')),
    ...(await import('../../../utils/password')),
    ...(await import('./notices/issue-service')),
    ...(await import('./notices/sign-service')),
    ...(await import('./notices/detail-service')),
    ...(await import('./notices/conduct-sweep')),
    ...(await import('./appeals/appeal-service')),
    ...(await import('./appeals/decision-service')),
    ...(await import('./documents/document-service')),
    ...(await import('./rollout/rollout-guard')),
    ...(await import('./documents/document-model')),
    ...(await import('../verify/verify-service')),
    ...(await import('../_shared/limits/rate-limit')),
    ...(await import('../documents')),
  });
  let m: Awaited<ReturnType<typeof load>>;

  const PIN = '4321';
  const ORIGIN = 'http://localhost:3000';
  let townId = '';
  let hr: Subject;
  let director: Subject;
  let townManager: Subject;
  let highwayManager: Subject;
  let accountant: Subject;
  let barista: Subject;
  let employeeId = '';
  let hadSwitch = false;
  const pinsBefore = new Map<string, string | null>();
  const noticeIds: string[] = [];
  let key = 0;
  const nextKey = (label: string) => `${label}-${tag}-${(key += 1)}`;
  const OWN_LINE = 'Arrived after the opening briefing twice this week without a call.';
  const issue = (who: Subject, label: string) =>
    m.issueNotice(who, { personId: employeeId, level: 'WRITTEN_WARNING', about: 'BEHAVIOUR', ownLine: OWN_LINE, pin: PIN, idempotencyKey: nextKey(label) }, null);

  beforeAll(async () => {
    m = await load();
    const user = (email: string) => m.prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, siteId: true, pinHash: true } });
    const [admin, dir, acc, bmTown, bmHighway, baristaUser] = await Promise.all(['admin', 'director', 'accountant', 'bm.town', 'bm.highway', 'barista.head.town'].map((n) => user(`${n}@wendo.test`)));
    for (const u of [admin!, dir!, bmTown!, baristaUser!]) pinsBefore.set(u.id, u.pinHash);
    const pinHash = await m.hashPin(PIN);
    for (const u of [admin!, dir!, bmTown!, baristaUser!]) await m.prisma.user.update({ where: { id: u.id }, data: { pinHash } });
    townId = bmTown!.siteId!;
    employeeId = (await m.prisma.employee.findFirstOrThrow({ where: { userId: baristaUser!.id } })).id;
    hr = { id: admin!.id, role: 'HR_MANAGER', siteId: null, headOfDepartmentIds: [] };
    director = { id: dir!.id, role: 'DIRECTOR', siteId: dir!.siteId, headOfDepartmentIds: [] };
    accountant = { id: acc!.id, role: 'ACCOUNTANT', siteId: acc!.siteId, headOfDepartmentIds: [] };
    townManager = { id: bmTown!.id, role: 'MANAGER', siteId: townId, headOfDepartmentIds: [] };
    highwayManager = { id: bmHighway!.id, role: 'MANAGER', siteId: bmHighway!.siteId, headOfDepartmentIds: [] };
    barista = { id: baristaUser!.id, role: 'BARISTA', siteId: townId, headOfDepartmentIds: [] };
    hadSwitch = (await m.prisma.attendanceSiteSwitch.count({ where: { siteId: townId } })) > 0;
  }, 60_000);

  afterAll(async () => {
    if (!m) return;
    const ids = await m.prisma.conductNotice.findMany({ where: { employeeId }, select: { id: true } });
    const all = ids.map((n) => n.id);
    // The index rows these notices made go with them (the index has no append-only rule; the audit log does).
    const made = await m.prisma.conductNotice.findMany({ where: { id: { in: all }, number: { not: null } }, select: { companyId: true, number: true } });
    await m.prisma.workforceDocument.deleteMany({ where: { kind: 'WRN', OR: made.map((n) => ({ companyId: n.companyId, number: `WRN-${String(n.number).padStart(4, '0')}` })) } });
    await m.prisma.conductNoticeDocument.deleteMany({ where: { noticeId: { in: all } } });
    await m.prisma.conductDecision.deleteMany({ where: { noticeId: { in: all } } });
    await m.prisma.conductNoticeEvent.deleteMany({ where: { noticeId: { in: all } } });
    await m.prisma.conductNotice.deleteMany({ where: { id: { in: all } } });
    if (hadSwitch) await m.prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabled: false } });
    else await m.prisma.attendanceSiteSwitch.deleteMany({ where: { siteId: townId } });
    for (const [id, pinHash] of pinsBefore) await m.prisma.user.update({ where: { id }, data: { pinHash } });
    await m.prisma.$disconnect();
  }, 60_000);

  it('a branch with the switch off cannot issue, and the old HR screen is still allowed there', async () => {
    await m.prisma.attendanceSiteSwitch.upsert({ where: { siteId: townId }, create: { siteId: townId, enabled: false }, update: { enabled: false } });
    await expect(issue(townManager, 'off')).rejects.toMatchObject({ statusCode: 409, code: 'CONDUCT_NOT_ENABLED' });
    await expect(m.refuseLegacyConductWhenSwitched(townId)).resolves.toBeUndefined();
  });

  it('with the switch on, the old HR screen is refused for that branch', async () => {
    await m.prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabled: true, enabledAt: new Date() } });
    await expect(m.refuseLegacyConductWhenSwitched(townId)).rejects.toMatchObject({ statusCode: 409, code: 'CONDUCT_IN_NEW_SYSTEM' });
  });

  let first = { id: '', number: '' as string | null };
  it('a manager issues a written warning; the same key twice is one notice; nobody issues to themself', async () => {
    const body = { personId: employeeId, level: 'WRITTEN_WARNING', about: 'BEHAVIOUR', ownLine: OWN_LINE, pin: PIN, idempotencyKey: nextKey('issue') } as const;
    const a = await m.issueNotice(townManager, body, 'Linux, Firefox');
    const b = await m.issueNotice(townManager, body, 'Linux, Firefox');
    expect(a).toMatchObject({ level: 'WRITTEN_WARNING', status: 'ISSUED' });
    expect(a.number).toMatch(/^WRN-\d{4}$/);
    expect(b.id).toBe(a.id);
    first = { id: a.id, number: a.number };
    noticeIds.push(a.id);
    // Still waiting for the person: numbered, but not in the Signed documents index yet.
    expect(await m.prisma.workforceDocument.count({ where: { number: a.number as string } })).toBe(0);
    await expect(m.issueNotice(barista, { ...body, idempotencyKey: nextKey('self') }, null)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('who sees the notice: its person and its branch yes; another branch, the Accountant and a stranger get 404; nobody but HR and the Director may decide', async () => {
    expect(await m.noticeDetail(barista, first.id)).toMatchObject({ view: 'STAFF', id: first.id });
    expect(await m.noticeDetail(townManager, first.id)).toMatchObject({ view: 'DESK', id: first.id });
    expect(await m.noticeDetail(hr, first.id)).toMatchObject({ view: 'DESK' });
    await expect(m.noticeDetail(highwayManager, first.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.noticeDetail(accountant, first.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(m.decideNotice(townManager, first.id, { outcome: 'KEEP', reason: 'Not mine to decide', pin: PIN, idempotencyKey: nextKey('mgr') }, null)).rejects.toMatchObject({ statusCode: 403 });
    await expect(m.decideNotice(barista, first.id, { outcome: 'KEEP', reason: 'Not mine to decide', pin: PIN, idempotencyKey: nextKey('own') }, null)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('the person signs with their code; signing twice is one signature; a wrong code is refused and written down', async () => {
    await expect(m.signNotice(barista, first.id, { code: '0000', deviceId: 'phone-1', idempotencyKey: nextKey('bad') }, 'Android, Chrome')).rejects.toMatchObject({ code: 'PIN_INVALID' });
    expect(await m.prisma.auditEntry.count({ where: { subjectId: first.id, action: 'conduct.sign_try_failed' } })).toBe(1);
    const signed = await m.signNotice(barista, first.id, { code: PIN, deviceId: 'phone-1', idempotencyKey: nextKey('sign') }, 'Android, Chrome');
    expect(signed).toMatchObject({ status: 'SIGNED', alreadySigned: false });
    expect(await m.signNotice(barista, first.id, { code: PIN, deviceId: 'phone-1', idempotencyKey: nextKey('sign') }, null)).toMatchObject({ alreadySigned: true });
    await expect(m.signNotice(highwayManager, first.id, { code: PIN, deviceId: 'x', idempotencyKey: nextKey('other') }, null)).rejects.toMatchObject({ statusCode: 404 });
  });

  const whoChecks = () => ({ address: `10.8.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`, deviceLabel: null });
  const indexed = (number: string) => m.prisma.workforceDocument.findMany({ where: { kind: 'WRN', number }, orderBy: { version: 'asc' } });

  it('signing puts the letter in the Signed documents index in the same transaction; the QR carries the index hash; no reason or category reaches the index', async () => {
    m.resetRateLimits();
    const [row] = await indexed(first.number as string);
    expect(row).toMatchObject({ version: 1, status: 'CURRENT', title: 'Warning notice · Written warning', signedByRole: 'Branch Manager', method: 'PIN' });
    expect(row?.subjectUserId).toBe(barista.id);
    expect(`${row?.title} ${row?.about} ${row?.searchText}`).not.toMatch(/behaviour|briefing|arrived|called|lateness|absence/i);
    const notice = await m.prisma.conductNotice.findUniqueOrThrow({ where: { id: first.id } });
    const qr = m.buildConductDoc({ notice, version: 1, decisions: [], withdrawn: false, witness: null, recordedBy: null, origin: ORIGIN }).qrUrl;
    expect(qr).toBe(`${ORIGIN}/verify/wrn/${first.number}?h=${row?.hashPrefix}`);
    expect(await m.checkDocument('wrn', first.number as string, row?.hashPrefix as string, whoChecks())).toMatchObject({ answer: { outcome: 'GENUINE', number: first.number, signedByRole: 'Branch Manager' } });
    expect((await m.checkDocument('wrn', 'WRN-9999', row?.hashPrefix as string, whoChecks())).answer.outcome).toBe('NOT_VERIFIED');
  });

  it('the letter is a PDF kept once the receipt is final; a manager opening it is audited, the person is not', async () => {
    const doc = await m.noticeDocument(townManager, first.id, 'latest', ORIGIN, 'Linux, Firefox');
    expect(doc.bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(doc.fileName).toBe(`${first.number}.pdf`);
    expect(await m.prisma.conductNoticeDocument.count({ where: { noticeId: first.id } })).toBe(1);
    const again = await m.noticeDocument(barista, first.id, 'latest', ORIGIN, null);
    expect(again.hash).toBe(doc.hash);
    expect(await m.prisma.auditEntry.count({ where: { subjectId: first.id, action: 'conduct.document_read' } })).toBe(1);
    await expect(m.noticeDocument(townManager, first.id, 2, ORIGIN, null)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('the person appeals; HR reduces it to a verbal note: a linked replacement, and the old letter gains a decision page as version 2', async () => {
    const appeal = { reasonKey: 'TOO_STRONG', text: 'The call was made to the supervisor that morning.' } as const;
    expect(await m.appealNotice(barista, first.id, { ...appeal, idempotencyKey: nextKey('appeal') }, null)).toMatchObject({ status: 'APPEALED' });
    const key = nextKey('decide');
    const decided = await m.decideNotice(hr, first.id, { outcome: 'REDUCE_TO_VERBAL', reason: 'The call was made; a verbal note is enough.', pin: PIN, idempotencyKey: key }, null);
    expect(decided).toMatchObject({ status: 'REPLACED', outcome: 'REDUCE_TO_VERBAL', version: 2, alreadyDecided: false });
    expect(decided.newNoticeId).not.toBeNull();
    noticeIds.push(decided.newNoticeId as string);
    const replay = await m.decideNotice(hr, first.id, { outcome: 'REDUCE_TO_VERBAL', reason: 'The call was made; a verbal note is enough.', pin: PIN, idempotencyKey: key }, null);
    expect(replay).toMatchObject({ alreadyDecided: true, newNoticeId: decided.newNoticeId });
    const v2 = await m.noticeDocument(hr, first.id, 'latest', ORIGIN, null);
    expect(v2.fileName).toBe(`${first.number}-v2.pdf`);
    expect(await m.prisma.conductNoticeDocument.count({ where: { noticeId: first.id } })).toBe(2);
    expect(await m.prisma.conductNotice.findUniqueOrThrow({ where: { id: decided.newNoticeId as string } })).toMatchObject({ level: 'VERBAL_NOTE', replacesNoticeId: first.id, number: null });
  });

  it('the decision page is version 2 of the same number: version 1 reads replaced, version 2 genuine; the verbal replacement has no number so it is not indexed', async () => {
    m.resetRateLimits();
    const [v1, v2, ...rest] = await indexed(first.number as string);
    expect(rest).toEqual([]);
    expect(v1).toMatchObject({ version: 1, status: 'REPLACED', replacedByVersion: 2 });
    expect(v2).toMatchObject({ version: 2, status: 'CURRENT', signedByRole: 'HR' });
    expect(v2?.hash).not.toBe(v1?.hash);
    expect((await m.checkDocument('wrn', first.number as string, v1?.hashPrefix as string, whoChecks())).answer).toMatchObject({ outcome: 'REPLACED', version: 1, replacedByVersion: 2 });
    expect((await m.checkDocument('wrn', first.number as string, v2?.hashPrefix as string, whoChecks())).answer).toMatchObject({ outcome: 'GENUINE', version: 2 });
    const notice = await m.prisma.conductNotice.findUniqueOrThrow({ where: { id: first.id } });
    const decisions = await m.prisma.conductDecision.findMany({ where: { noticeId: first.id }, orderBy: { version: 'asc' } });
    const qr2 = m.buildConductDoc({ notice, version: 2, decisions, withdrawn: false, witness: null, recordedBy: null, origin: ORIGIN }).qrUrl;
    expect(qr2).toBe(`${ORIGIN}/verify/wrn/${first.number}?h=${v2?.hashPrefix}`);
    expect(`${v2?.title} ${v2?.about} ${v2?.searchText}`).not.toMatch(/call was made|verbal note is enough/i);
  });

  it('a failure after the door call rolls the index row back with the signature', async () => {
    const fifth = await issue(townManager, 'fifth');
    noticeIds.push(fifth.id);
    const { conductNoticesRepository } = await import('./_shared/conduct-notices-repository');
    const { vi } = await import('vitest');
    const spy = vi.spyOn(conductNoticesRepository, 'addEvent').mockRejectedValueOnce(new Error('the signer failed after registering'));
    await expect(m.signNotice(barista, fifth.id, { code: PIN, deviceId: 'phone-1', idempotencyKey: nextKey('sign5') }, null)).rejects.toThrow('the signer failed');
    spy.mockRestore();
    expect(await indexed(fifth.number as string)).toHaveLength(0);
    expect(await m.prisma.conductNotice.findUniqueOrThrow({ where: { id: fifth.id }, select: { status: true, signedAt: true } })).toEqual({ status: 'ISSUED', signedAt: null });
  });

  it('a notice HR withdraws reads withdrawn on every version of its number', async () => {
    m.resetRateLimits();
    const fourth = await issue(townManager, 'fourth');
    noticeIds.push(fourth.id);
    await m.signNotice(barista, fourth.id, { code: PIN, deviceId: 'phone-1', idempotencyKey: nextKey('sign4') }, null);
    await m.decideNotice(hr, fourth.id, { outcome: 'WITHDRAW', reason: 'Issued to the wrong person by mistake.', pin: PIN, idempotencyKey: nextKey('withdraw') }, null);
    const rows = await indexed(fourth.number as string);
    expect(rows.map((r) => [r.version, r.status])).toEqual([[1, 'WITHDRAWN'], [2, 'WITHDRAWN']]);
    expect(rows[0]?.withdrawnByRole).toBe('HR');
    const verdict = await m.checkDocument('wrn', fourth.number as string, rows[1]?.hashPrefix as string, whoChecks());
    expect(verdict.answer).toMatchObject({ outcome: 'WITHDRAWN', withdrawnByRole: 'HR' });
    expect(JSON.stringify(verdict.answer)).not.toMatch(/mistake|wrong person/i);
  });

  it('two deciders at once: one wins, the other is told it was already decided', async () => {
    const second = await issue(townManager, 'second');
    noticeIds.push(second.id);
    await m.signNotice(barista, second.id, { code: PIN, deviceId: 'phone-1', idempotencyKey: nextKey('sign2') }, null);
    await m.appealNotice(barista, second.id, { reasonKey: 'FACTS_WRONG', text: 'The dates in the letter are not the dates.', idempotencyKey: nextKey('appeal2') }, null);
    const attempt = (outcome: 'KEEP' | 'WITHDRAW') => m.decideNotice(hr, second.id, { outcome, reason: 'Decided after reading both sides.', pin: PIN, idempotencyKey: nextKey(outcome) }, null);
    const results = await Promise.allSettled([attempt('KEEP'), attempt('WITHDRAW')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(lost.reason).toMatchObject({ statusCode: 409, code: 'ALREADY_DECIDED' });
    expect(await m.prisma.conductDecision.count({ where: { noticeId: second.id } })).toBe(1);
  });

  it('the director cannot decide a notice a manager issued', async () => {
    const third = await issue(townManager, 'third');
    noticeIds.push(third.id);
    await expect(m.decideNotice(director, third.id, { outcome: 'KEEP', reason: 'Should be HR who decides.', pin: PIN, idempotencyKey: nextKey('dir') }, null)).rejects.toMatchObject({ statusCode: 403 });
  });

  it('the nightly sweep ends notices past their end date, once, and a second run changes nothing', async () => {
    const later = new Date(Date.now() + 800 * 86_400_000);
    const run = await m.sweepConduct(later);
    expect(run.ended).toBeGreaterThanOrEqual(1);
    expect(await m.prisma.conductNotice.count({ where: { id: { in: noticeIds }, status: 'ENDED' } })).toBeGreaterThanOrEqual(1);
    expect(await m.sweepConduct(later)).toMatchObject({ ended: 0 });
  });

  it('a notice that ended while still waiting for the person is indexed when it ends; the reconciliation rebuilds every row exactly and a second run adds nothing', async () => {
    const third = (await m.prisma.conductNotice.findFirstOrThrow({ where: { id: { in: noticeIds }, signedAt: null, status: 'ENDED', number: { not: null } } })).number;
    expect(await indexed(`WRN-${String(third).padStart(4, '0')}`)).toHaveLength(1);

    const mine = await m.prisma.conductNotice.findMany({ where: { id: { in: noticeIds }, number: { not: null } }, select: { companyId: true, number: true } });
    const where = { kind: 'WRN', OR: mine.map((n) => ({ companyId: n.companyId, number: `WRN-${String(n.number).padStart(4, '0')}` })) };
    const shape = { number: true, version: true, hash: true, hashPrefix: true, status: true, title: true, about: true, signedByRole: true, withdrawnByRole: true, replacedByVersion: true } as const;
    const byKey = (a: { number: string; version: number }, b: { number: string; version: number }) => a.number.localeCompare(b.number) || a.version - b.version;
    const before = (await m.prisma.workforceDocument.findMany({ where, select: shape })).sort(byKey);
    expect(before.length).toBeGreaterThanOrEqual(5);

    await m.prisma.workforceDocument.deleteMany({ where });
    m.registerDocuments();
    const companyId = (await m.prisma.conductNotice.findFirstOrThrow({ where: { id: noticeIds[0] as string } })).companyId;
    const run = await m.reconcileDocuments(companyId);
    expect(run.failed).toBe(0);
    expect((await m.prisma.workforceDocument.findMany({ where, select: shape })).sort(byKey)).toEqual(before);
    expect((await m.reconcileDocuments(companyId)).registered).toBe(0);
    expect(await m.prisma.workforceDocument.count({ where })).toBe(before.length);
  });

  it('the notices repository has no delete: nothing in it can remove a notice', () => {
    const source = readFileSync(join(__dirname, '_shared', 'conduct-notices-repository.ts'), 'utf8');
    expect(source).not.toMatch(/\.delete(Many)?\(/);
    expect(source).not.toMatch(/DELETE\s+FROM/i);
  });
});
