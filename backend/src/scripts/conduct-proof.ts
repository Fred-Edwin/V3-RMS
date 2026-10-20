/**
 * Workforce Segment 5 (Conduct, back end): the per-role HTTP proof against the lane database.
 * The app is served inside this process (the same Express app and middleware the API runs), with real logins.
 *   up    cleans leftovers of an earlier run first, makes a fixture (an HR login, a waiter with a code, a colleague, a person with no
 *         login; Nyeri Town's switch on), walks every role through what it can and cannot do, runs the whole flow (issue, sign, PDF,
 *         appeal, decision, not-signed with a named witness) and then, unless KEEP=1, removes it all and puts PINs and the switch back.
 *   down  removes everything `up` made (the audit log is append-only by design and keeps its rows).
 * Usage: RATE_LIMIT_MAX=100000 pnpm exec tsx src/scripts/conduct-proof.ts up|down     (KEEP=1 keeps the data to read it)
 * Real logins are cached in the scratchpad file named by PROOF_TOKEN_CACHE, so a repeat run does not sign in again.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { app } from '../app';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { hashPassword, hashPin } from '../utils/password';

const TAG = 'ZZ Proof 5';
const PASSWORD = 'password123';
const PIN = '4321';
const out = (line: string): void => void process.stdout.write(`${line}\n`);
let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, detail = ''): void => {
  if (ok) passed += 1;
  else failed += 1;
  out(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   <- ${detail}`}`);
};

type Body = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- the proof reads loose JSON
type Reply = { status: number; type: string; bytes: number; body: { data?: Body; error?: { code?: string; message?: string } } };
let base = '';
const tokens = new Map<string, string>();
const cachePath = process.env['PROOF_TOKEN_CACHE'];
const cached = new Set(['admin', 'director', 'bm.town', 'bm.highway', 'accountant'].map((n) => `${n}@wendo.test`));

const rawLogin = async (email: string): Promise<boolean> => {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  if (json.data?.accessToken) tokens.set(email, json.data.accessToken);
  return res.status === 200;
};
const call = async (who: string, method: string, path: string, body?: object): Promise<Reply> => {
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.get(who)}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const type = res.headers.get('content-type') ?? '';
  if (type.includes('application/pdf')) return { status: res.status, type, bytes: (await res.arrayBuffer()).byteLength, body: {} };
  let parsed: Reply['body'] = {};
  try {
    parsed = (await res.json()) as Reply['body'];
  } catch {
    /* empty */
  }
  return { status: res.status, type, bytes: 0, body: parsed };
};
const short = (path: string): string => (path.split('?')[0] ?? path).replace('/workforce/', '').replace(/[0-9a-f-]{36}/g, ':id');
const expectStatus = async (who: string, method: string, path: string, expected: number, body?: object, code?: string): Promise<Reply> => {
  const r = await call(who, method, path, body);
  const ok = r.status === expected && (code === undefined || r.body.error?.code === code);
  check(`${who.split('@')[0]} ${method} ${short(path)} -> ${expected}${code ? ` ${code}` : ''}`, ok, `got ${r.status} ${JSON.stringify(r.body).slice(0, 220)}`);
  return r;
};

const ADMIN = 'admin@wendo.test';
const DIRECTOR = 'director@wendo.test';
const BM = 'bm.town@wendo.test';
const HIGHWAY = 'bm.highway@wendo.test';
const ACCOUNTANT = 'accountant@wendo.test';
const HEAD = 'barista.head.town@wendo.test';
const HR = 'zz.proof.5.hr@wendo.test';
const STAFF = 'zz.proof.5.staff@wendo.test';
const COLLEAGUE = 'zz.proof.5.colleague@wendo.test';
const C = '/workforce/conduct';
const LINE = 'Arrived after the opening briefing twice this week without a call.';
const DEVICE = 'proof-device-5-0001';
let seq = 0;
const key = (label: string): string => `${label}-${randomUUID().slice(0, 8)}-${(seq += 1)}`;

async function down(restore = true): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { startsWith: 'zz.proof.5.' }, NOT: { email: { startsWith: 'zz.proof.5.old.' } } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const employees = await prisma.employee.findMany({ where: { OR: [{ userId: { in: ids } }, { name: { startsWith: TAG } }] }, select: { id: true } });
  const notices = (await prisma.conductNotice.findMany({ where: { employeeId: { in: employees.map((e) => e.id) } }, select: { id: true } })).map((n) => n.id);
  await prisma.conductNoticeDocument.deleteMany({ where: { noticeId: { in: notices } } });
  await prisma.conductDecision.deleteMany({ where: { noticeId: { in: notices } } });
  await prisma.conductNoticeEvent.deleteMany({ where: { noticeId: { in: notices } } });
  await prisma.conductNotice.updateMany({ where: { id: { in: notices } }, data: { replacesNoticeId: null, replacedById: null } });
  await prisma.conductNotice.deleteMany({ where: { id: { in: notices } } });
  const everyone = [...ids, ...(await prisma.user.findMany({ where: { email: { in: [HEAD, BM, DIRECTOR] } }, select: { id: true } })).map((u) => u.id)];
  await prisma.workforceNotification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.workforcePinTry.deleteMany({ where: { userId: { in: everyone } } });
  await prisma.workforceSecurityAlert.deleteMany({ where: { subjectUserId: { in: ids } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await prisma.employee.deleteMany({ where: { id: { in: employees.map((e) => e.id) } } }).catch(() => undefined);
  // The audit log is append-only, so a person who wrote to it cannot be deleted: they stay, switched off, renamed.
  for (const u of users) {
    const gone = await prisma.user.delete({ where: { id: u.id } }).then(() => true, () => false);
    if (!gone) await prisma.user.update({ where: { id: u.id }, data: { isActive: false, isTestUser: true, email: `zz.proof.5.old.${u.id}@wendo.test` } });
  }
  if (restore) {
    const town = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { siteId: true } });
    if (town.siteId) await prisma.attendanceSiteSwitch.updateMany({ where: { siteId: town.siteId }, data: { enabled: false } });
    const backup = process.env['PROOF_PIN_BACKUP'] && existsSync(process.env['PROOF_PIN_BACKUP']) ? (JSON.parse(readFileSync(process.env['PROOF_PIN_BACKUP'], 'utf8')) as Record<string, string | null>) : {};
    for (const [id, pinHash] of Object.entries(backup)) await prisma.user.update({ where: { id }, data: { pinHash } }).catch(() => undefined);
  }
  out('Proof data removed; Nyeri Town switch is off again.');
}

async function up(): Promise<void> {
  await down(false);
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}${env.API_PREFIX}`;
  const pinBackupPath = process.env['PROOF_PIN_BACKUP'];
  try {
    out('== 0. fixture');
    const bm = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { id: true, siteId: true, site: { select: { companyId: true } } } });
    const siteId = bm.siteId!;
    const companyId = bm.site!.companyId;
    const switchBefore = await prisma.attendanceSiteSwitch.findUnique({ where: { siteId } });
    await prisma.attendanceSiteSwitch.upsert({ where: { siteId }, create: { siteId, enabled: true, enabledAt: new Date() }, update: { enabled: true } });
    const pinned = await prisma.user.findMany({ where: { email: { in: [ADMIN, DIRECTOR, BM, HEAD] } }, select: { id: true, pinHash: true } });
    if (pinBackupPath && !existsSync(pinBackupPath)) writeFileSync(pinBackupPath, JSON.stringify(Object.fromEntries(pinned.map((u) => [u.id, u.pinHash]))));
    const pinHash = await hashPin(PIN);
    await prisma.user.updateMany({ where: { id: { in: pinned.map((u) => u.id) } }, data: { pinHash } });
    const password = await hashPassword(PASSWORD);
    const mk = (email: string, role: 'HR_MANAGER' | 'WAITER', name: string, withSite: boolean) =>
      prisma.user.create({ data: { id: randomUUID(), ...(withSite ? { siteId } : {}), name: `${TAG} ${name}`, email, role, passwordHash: password, pinHash, isTestUser: true } });
    await mk(HR, 'HR_MANAGER', 'HR', false);
    const staff = await mk(STAFF, 'WAITER', 'Staff', true);
    const colleague = await mk(COLLEAGUE, 'WAITER', 'Colleague', true);
    const person = (userId: string | null, name: string) =>
      prisma.employee.create({ data: { companyId, siteId, ...(userId ? { userId } : {}), employeeNumber: `ZZ5-${randomUUID().slice(0, 8)}`, name: `${TAG} ${name}`, payType: 'DAILY_RATE', startDate: new Date('2026-01-01'), status: 'ACTIVE' } });
    const staffEmp = await person(staff.id, 'Staff');
    await person(colleague.id, 'Colleague');
    const noLogin = await person(null, 'No Login');
    const cacheFile = cachePath && existsSync(cachePath) ? (JSON.parse(readFileSync(cachePath, 'utf8')) as Record<string, string>) : {};
    for (const who of [ADMIN, DIRECTOR, BM, HIGHWAY, ACCOUNTANT, HEAD, HR, STAFF, COLLEAGUE]) {
      const token = cached.has(who) ? cacheFile[who] : undefined;
      if (token) {
        tokens.set(who, token);
        if ((await call(who, 'GET', `${C}/badge`)).status !== 401) continue;
      }
      check(`${who.split('@')[0]} signs in`, await rawLogin(who));
    }
    if (cachePath) writeFileSync(cachePath, JSON.stringify(Object.fromEntries([...tokens].filter(([k]) => cached.has(k)))));

    out('\n== 1. the new routes exist in this code (a 404 here means stale code)');
    const probe = await call(STAFF, 'GET', `${C}/badge`);
    check('GET /badge answers 200 with a count, not 404', probe.status === 200 && probe.body.data !== undefined, `got ${probe.status}`);
    await expectStatus(STAFF, 'GET', `${C}/me`, 200);

    out('\n== 2. who may do what (capability gates)');
    for (const who of [STAFF, COLLEAGUE, HEAD, ACCOUNTANT]) {
      await expectStatus(who, 'GET', C, 403);
      await expectStatus(who, 'GET', `${C}/people`, 403);
      await expectStatus(who, 'POST', C, 403, { personId: staffEmp.id, level: 'WRITTEN_WARNING', about: 'BEHAVIOUR', ownLine: LINE, pin: PIN, idempotencyKey: key('x') });
    }
    for (const who of [DIRECTOR, BM, HR]) await expectStatus(who, 'GET', C, 200);
    await expectStatus(ADMIN, 'GET', C, 403); // the System Admin runs the system, not people matters: no discipline row in the access table
    await expectStatus(DIRECTOR, 'GET', `${C}/people`, 403);
    await expectStatus(DIRECTOR, 'POST', C, 403, { personId: staffEmp.id, level: 'WRITTEN_WARNING', about: 'BEHAVIOUR', ownLine: LINE, pin: PIN, idempotencyKey: key('d') });
    await expectStatus(BM, 'POST', C, 400, { personId: staffEmp.id, level: 'WRITTEN_WARNING', about: 'BEHAVIOUR', ownLine: 'too short', pin: PIN, idempotencyKey: key('v') });
    await expectStatus(BM, 'GET', `${C}/people?q=Staff`, 200);
    await expectStatus(BM, 'GET', `${C}/draft?personId=${staffEmp.id}&about=BEHAVIOUR`, 200);
    const preview = await call(BM, 'POST', `${C}/draft/preview`, { personId: staffEmp.id, level: 'WRITTEN_WARNING', about: 'BEHAVIOUR', ownLine: LINE });
    check('BM POST draft/preview -> 200 PDF', preview.status === 200 && preview.type.includes('pdf') && preview.bytes > 1000, `got ${preview.status} ${preview.type}`);

    out('\n== 3. issue, scope (404 vs 403), idempotency');
    const issueBody = { personId: staffEmp.id, level: 'WRITTEN_WARNING', about: 'BEHAVIOUR', ownLine: LINE, pin: PIN, idempotencyKey: key('issue') };
    const issued = await expectStatus(BM, 'POST', C, 201, issueBody);
    const notice = String(issued.body.data?.['id'] ?? '');
    const again = await call(BM, 'POST', C, issueBody);
    check('the same key twice is the same notice', String(again.body.data?.['id']) === notice, JSON.stringify(again.body).slice(0, 160));
    await expectStatus(BM, 'POST', C, 403, { ...issueBody, pin: '0000', idempotencyKey: key('badpin') });
    await expectStatus(HIGHWAY, 'GET', `${C}/${notice}`, 404);
    await expectStatus(HIGHWAY, 'POST', `${C}/${notice}/not-signed`, 404, { reason: 'REFUSED', witnessId: randomUUID(), pin: PIN, idempotencyKey: key('h') });
    await expectStatus(COLLEAGUE, 'GET', `${C}/${notice}`, 404);
    await expectStatus(HEAD, 'GET', `${C}/${notice}`, 404);
    await expectStatus(ACCOUNTANT, 'GET', `${C}/${notice}`, 404);
    for (const who of [BM, HR, DIRECTOR, STAFF]) await expectStatus(who, 'GET', `${C}/${notice}`, 200);
    await expectStatus(ADMIN, 'GET', `${C}/${notice}`, 403);
    const list = await call(HIGHWAY, 'GET', C);
    check("another branch's manager does not list Nyeri Town's notice (cross-site)", !JSON.stringify(list.body).includes(notice));
    const staffMe = await call(STAFF, 'GET', `${C}/me`);
    check('the person sees it in their own list', JSON.stringify(staffMe.body).includes(notice));
    check('the push/inbox text never carries the reason', !(await prisma.workforceNotification.findMany({ where: { userId: staffMe.body.data ? (await prisma.user.findUniqueOrThrow({ where: { email: STAFF } })).id : '' } })).some((n) => JSON.stringify(n).includes('briefing')));

    out('\n== 4. sign, then the PDF over HTTP');
    await expectStatus(STAFF, 'POST', `${C}/${notice}/sign`, 403, { code: '9999', deviceId: DEVICE, idempotencyKey: key('sw') });
    await expectStatus(COLLEAGUE, 'POST', `${C}/${notice}/sign`, 404, { code: PIN, deviceId: DEVICE, idempotencyKey: key('sc') });
    const signKey = key('sign');
    await expectStatus(STAFF, 'POST', `${C}/${notice}/sign`, 200, { code: PIN, deviceId: DEVICE, idempotencyKey: signKey });
    const signedAgain = await call(STAFF, 'POST', `${C}/${notice}/sign`, { code: PIN, deviceId: DEVICE, idempotencyKey: signKey });
    check('signing twice is one signature', signedAgain.status === 200 || signedAgain.status === 409, `got ${signedAgain.status}`);
    const readsBefore = await prisma.auditEntry.count({ where: { action: 'conduct.document_read' } });
    const pdf = await call(BM, 'GET', `${C}/${notice}/document`);
    check('BM GET document -> 200 application/pdf with bytes', pdf.status === 200 && pdf.type.includes('pdf') && pdf.bytes > 1000, `got ${pdf.status} ${pdf.type} ${pdf.bytes}`);
    const ownPdf = await call(STAFF, 'GET', `${C}/${notice}/document`);
    check('the person opens their own letter', ownPdf.status === 200 && ownPdf.bytes > 1000, `got ${ownPdf.status}`);
    await expectStatus(COLLEAGUE, 'GET', `${C}/${notice}/document`, 404);
    const readsAfter = await prisma.auditEntry.count({ where: { action: 'conduct.document_read' } });
    check("opening it as a manager wrote one audit entry, the person's own read wrote none", readsAfter === readsBefore + 1, `before ${readsBefore}, after ${readsAfter}`);

    out('\n== 5. appeal and decision');
    await expectStatus(COLLEAGUE, 'POST', `${C}/${notice}/appeal`, 404, { reasonKey: 'OTHER', text: 'Not mine to appeal at all.', idempotencyKey: key('ac') });
    await expectStatus(STAFF, 'POST', `${C}/${notice}/appeal`, 400, { reasonKey: 'OTHER', text: 'short', idempotencyKey: key('as') });
    await expectStatus(STAFF, 'POST', `${C}/${notice}/appeal`, 200, { reasonKey: 'TOO_STRONG', text: 'I was late once, not twice, and I rang ahead.', idempotencyKey: key('appeal') });
    await expectStatus(STAFF, 'POST', `${C}/${notice}/decision`, 403, { outcome: 'KEEP', reason: 'Staff cannot decide.', pin: PIN, idempotencyKey: key('sd') });
    await expectStatus(BM, 'POST', `${C}/${notice}/decision`, 403, { outcome: 'KEEP', reason: 'A manager cannot decide.', pin: PIN, idempotencyKey: key('bd') });
    await expectStatus(DIRECTOR, 'POST', `${C}/${notice}/decision`, 403, { outcome: 'KEEP', reason: 'A manager issued it.', pin: PIN, idempotencyKey: key('dd') });
    await expectStatus(HR, 'POST', `${C}/${notice}/decision/preview`, 200, { outcome: 'REDUCE_TO_VERBAL' });
    const decided = await expectStatus(HR, 'POST', `${C}/${notice}/decision`, 200, { outcome: 'REDUCE_TO_VERBAL', reason: 'First offence; a verbal note is enough.', pin: PIN, idempotencyKey: key('decide') });
    check('the decision names the new linked notice', typeof decided.body.data?.['newNoticeId'] === 'string', JSON.stringify(decided.body).slice(0, 160));
    const v2 = await call(HR, 'GET', `${C}/${notice}/document?version=2`);
    check('the old letter gained a decision page as version 2', v2.status === 200 && v2.bytes > 1000, `got ${v2.status}`);
    await expectStatus(HR, 'POST', `${C}/${notice}/decision`, 409, { outcome: 'WITHDRAW', reason: 'Second decider arrives late.', pin: PIN, idempotencyKey: key('late') });

    out('\n== 6. not signed, with a person who has no login, and a named witness');
    const second = await expectStatus(BM, 'POST', C, 201, { personId: noLogin.id, level: 'WRITTEN_WARNING', about: 'BEHAVIOUR', ownLine: LINE, pin: PIN, idempotencyKey: key('nl') });
    const nlId = String(second.body.data?.['id'] ?? '');
    await expectStatus(HEAD, 'GET', `${C}/${nlId}/witness`, 404);
    await expectStatus(BM, 'POST', `${C}/${nlId}/not-signed`, 422, { reason: 'REFUSED', witnessId: (await prisma.user.findUniqueOrThrow({ where: { email: HEAD } })).id, pin: PIN, idempotencyKey: key('wr') });
    await expectStatus(BM, 'POST', `${C}/${nlId}/not-signed`, 422, { reason: 'NO_LOGIN', witnessId: bm.id, pin: PIN, idempotencyKey: key('ws') });
    await expectStatus(HR, 'GET', `${C}/${nlId}/witness-options?q=Colleague`, 200);
    const head = await prisma.user.findUniqueOrThrow({ where: { email: HEAD } });
    await expectStatus(BM, 'POST', `${C}/${nlId}/not-signed`, 200, { reason: 'NO_LOGIN', witnessId: head.id, pin: PIN, idempotencyKey: key('ns') });
    await expectStatus(BM, 'POST', `${C}/${nlId}/not-signed`, 409, { reason: 'NO_LOGIN', witnessId: head.id, pin: PIN, idempotencyKey: key('ns2') }, 'ALREADY_RECORDED');
    await expectStatus(HEAD, 'GET', `${C}/${nlId}`, 404);
    await expectStatus(HEAD, 'GET', `${C}/${nlId}/witness`, 200);
    await expectStatus(COLLEAGUE, 'GET', `${C}/${nlId}/witness`, 404);
    await expectStatus(HEAD, 'POST', `${C}/${nlId}/witness`, 400, { confirmed: true });
    await expectStatus(HEAD, 'POST', `${C}/${nlId}/witness`, 200, { confirmed: true, code: PIN });
    const afterWitness = await call(BM, 'GET', `${C}/${nlId}`);
    const stored = await prisma.conductNotice.findUniqueOrThrow({ where: { id: nlId } });
    check('the notice reads "given, not signed" with the witness confirmed', afterWitness.status === 200 && stored.status === 'GIVEN_NOT_SIGNED' && stored.witnessId === head.id && stored.witnessConfirmedAt !== null, JSON.stringify({ status: stored.status, confirmedAt: stored.witnessConfirmedAt }));
    await expectStatus(BM, 'GET', `/workforce/people/${noLogin.id}/conduct`, 200);
    await expectStatus(HIGHWAY, 'GET', `/workforce/people/${noLogin.id}/conduct`, 404);

    out('\n== 7. a head sees nothing unless named a witness; badge and Needs you agree');
    const headList = await call(HEAD, 'GET', `${C}/badge`);
    check('the head gets a badge count from /badge', headList.status === 200, `got ${headList.status}`);
    const hrCounts = await call(HR, 'GET', '/workforce/needs-you/counts');
    check('HR Needs-you counts answer', hrCounts.status === 200, `got ${hrCounts.status}`);
    out(`\n${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exitCode = 1;
    if (switchBefore?.enabled) out('Note: the switch was on before the proof; down switches it off.');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (process.env['KEEP'] !== '1') await down();
    else out('KEEP=1: the data stays. Run "down" to remove it.');
  }
}

const mode = process.argv[2];
(mode === 'down' ? down() : mode === 'up' ? up() : Promise.reject(new Error('usage: conduct-proof.ts up|down')))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().finally(() => process.exit(process.exitCode ?? 0)));
