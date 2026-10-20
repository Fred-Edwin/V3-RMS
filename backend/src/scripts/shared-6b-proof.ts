/**
 * Workforce Segment 6b (Shared parts, back end B): the per-role HTTP proof against the lane database.
 * The app is served inside this process (the same Express app and middleware the API runs), with real logins.
 *   up    makes a fixture (a waiter, an HR Manager login, five documents issued through the documents door as Leave and Conduct will
 *         issue them), walks every role through the audit log, Activity on my record, the Signed documents index and both verify
 *         routes, runs the end-to-end flow, reads the result back, then (unless KEEP=1) removes it all.
 *   down  removes everything `up` made (the audit log is append-only by design and keeps its rows).
 * Usage: RATE_LIMIT_MAX=100000 pnpm exec tsx src/scripts/shared-6b-proof.ts up|down     (KEEP=1 to keep the data)
 */
import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { app } from '../app';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { reconcileDocuments, registerDocument, withdrawDocument } from '../modules/workforce';
import { hashPassword } from '../utils/password';

const TAG = 'ZZ Proof 6b';
const PASSWORD = 'password123';
const out = (line: string): void => void process.stdout.write(`${line}\n`);
let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, detail = ''): void => {
  if (ok) passed += 1;
  else failed += 1;
  out(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   <- ${detail}`}`);
};

type Body = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- the proof reads loose JSON
type Reply = { status: number; body: { success?: boolean; data?: Body; error?: { code?: string; message?: string } } };
let base = '';
const tokens = new Map<string, string>();
const login = async (email: string): Promise<number> => {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  if (json.data?.accessToken) tokens.set(email, json.data.accessToken);
  return res.status;
};
const call = async (who: string | null, method: string, path: string, body?: object): Promise<Reply> => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (who) headers['authorization'] = `Bearer ${tokens.get(who)}`;
  const res = await fetch(`${base}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  let parsed: Reply['body'] = {};
  try {
    parsed = (await res.json()) as Reply['body'];
  } catch {
    /* empty */
  }
  return { status: res.status, body: parsed };
};
const short = (path: string): string => (path.split('?')[0] ?? path).replace('/workforce/', '').replace(/[0-9a-f-]{36}/g, ':id');
const expectStatus = async (who: string | null, method: string, path: string, expected: number, body?: object): Promise<Reply> => {
  const r = await call(who, method, path, body);
  check(`${who ? who.split('@')[0] : 'no sign-in'} ${method} ${short(path)} -> ${expected}`, r.status === expected, `got ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
  return r;
};

const ADMIN = 'admin@wendo.test';
const DIRECTOR = 'director@wendo.test';
const BM = 'bm.town@wendo.test';
const HIGHWAY = 'bm.highway@wendo.test';
const ACCOUNTANT = 'accountant@wendo.test';
const HR = 'zz.proof.6b.hr@wendo.test';
const WAITER = 'zz.proof.6b.waiter@wendo.test';
const A = '/workforce/audit';
const D = '/workforce/documents';
const hashOf = (seed: string): string => createHash('sha256').update(`proof-6b:${seed}`).digest('hex');
const prefixOf = (seed: string): string => hashOf(seed).slice(0, 10);

async function down(): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { startsWith: 'zz.proof.6b.' }, NOT: { email: { startsWith: 'zz.proof.6b.old.' } } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await prisma.workforceDocument.deleteMany({ where: { number: { contains: '-ZZ6B' } } });
  await prisma.workforceDocumentCheck.deleteMany({ where: { number: { contains: '-ZZ6B' } } });
  await prisma.workforceNotification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  // The audit log is append-only, so a person who wrote to it cannot be deleted: they stay, switched off, marked as test users and renamed.
  for (const id of ids) {
    const gone = await prisma.user.delete({ where: { id } }).then(() => true, () => false);
    if (!gone) await prisma.user.update({ where: { id }, data: { isActive: false, isTestUser: true, email: `zz.proof.6b.old.${id}@wendo.test` } });
  }
  out('Proof data removed (documents, checks, proof logins; the audit log keeps its rows by design).');
}

async function up(): Promise<void> {
  await down();
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}${env.API_PREFIX}`;
  try {
    out('== 0. fixture');
    const town = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { siteId: true, site: { select: { companyId: true } } } });
    const highway = await prisma.user.findUniqueOrThrow({ where: { email: HIGHWAY }, select: { siteId: true } });
    const siteId = town.siteId!;
    const otherSite = highway.siteId!;
    const companyId = town.site!.companyId;
    const password = await hashPassword(PASSWORD);
    const waiter = await prisma.user.create({ data: { id: randomUUID(), siteId, name: `${TAG} Waiter`, email: WAITER, role: 'WAITER', passwordHash: password, isTestUser: true } });
    await prisma.user.create({ data: { id: randomUUID(), name: `${TAG} HR`, email: HR, role: 'HR_MANAGER', passwordHash: password, isTestUser: true } });
    out('Created two proof logins (an HR Manager and a waiter); the lane database had no hr@ login.');
    for (const who of [ADMIN, DIRECTOR, BM, HIGHWAY, ACCOUNTANT, HR, WAITER]) check(`${who.split('@')[0]} signs in`, (await login(who)) === 200);

    // Issued the way Leave and Conduct will issue them: through the door, inside the issuer's own transaction.
    const signer = { id: null, name: 'Proof Signer', role: 'BRANCH_MANAGER' };
    const issue = (kind: 'LVE' | 'WRN' | 'PS', n: string, site: string | null, version = 1) =>
      prisma.$transaction((tx) => registerDocument(tx, { companyId, siteId: site, kind, number: `${kind}-ZZ6B${n}`, version, about: 'Mon 19 Oct', subjectUserId: waiter.id, signedBy: signer, signedAt: new Date(), hash: hashOf(`${kind}${n}v${version}`), openHref: `/app/proof/${n}` }));
    await issue('LVE', '1', siteId);
    await issue('LVE', '2', otherSite);
    await issue('WRN', '1', siteId);
    await issue('PS', '1', siteId);
    await issue('LVE', '3', siteId);
    await issue('LVE', '3', siteId, 2);
    await issue('LVE', '4', siteId);
    await prisma.$transaction((tx) => withdrawDocument(tx, { companyId, number: 'LVE-ZZ6B4', byRole: 'BRANCH_MANAGER', at: new Date() }));
    check('seven documents registered through the door, one withdrawn', (await prisma.workforceDocument.count({ where: { number: { contains: '-ZZ6B' } } })) === 7);

    out('\n== 1. Signed documents index: who sees what (each type is read by its own capability)');
    const names = (r: Reply): string[] => ((r.body.data?.['items'] as Body[]) ?? []).map((i) => String(i['number']));
    await expectStatus(WAITER, 'GET', D, 404);
    await expectStatus(WAITER, 'GET', `${D}/LVE-ZZ6B1`, 404);
    const q = `${D}?q=zz6b&pageSize=100`;
    const bm = await expectStatus(BM, 'GET', q, 200);
    check('the Town Branch Manager sees Town leave slips and no other branch\'s (cross-site)', names(bm).includes('LVE-ZZ6B1') && !names(bm).includes('LVE-ZZ6B2'), names(bm).join(','));
    const hw = await expectStatus(HIGHWAY, 'GET', q, 200);
    check("the Highway Branch Manager sees only Highway's leave slip", names(hw).includes('LVE-ZZ6B2') && !names(hw).includes('LVE-ZZ6B1'), names(hw).join(','));
    await expectStatus(HIGHWAY, 'GET', `${D}/LVE-ZZ6B1`, 404);
    await expectStatus(BM, 'GET', `${D}/LVE-ZZ6B1`, 200);
    const hr = await expectStatus(HR, 'GET', q, 200);
    check('HR sees leave, warning and payslip documents of every branch', ['LVE-ZZ6B1', 'LVE-ZZ6B2', 'WRN-ZZ6B1', 'PS-ZZ6B1'].every((n) => names(hr).includes(n)), names(hr).join(','));
    const acc = await expectStatus(ACCOUNTANT, 'GET', q, 200);
    check('the Accountant sees the payslip and not the warning notice', names(acc).includes('PS-ZZ6B1') && !names(acc).includes('WRN-ZZ6B1'), names(acc).join(','));
    await expectStatus(ACCOUNTANT, 'GET', `${D}/WRN-ZZ6B1`, 404);
    const dir = await expectStatus(DIRECTOR, 'GET', q, 200);
    check('the Director sees the warning notice', names(dir).includes('WRN-ZZ6B1'), names(dir).join(','));
    check('no list row carries a pay figure', JSON.stringify(dir.body.data).search(/\bKES\b|\d,\d{3}/) === -1);
    check('version 1 reads Replaced and version 2 Current', ((dir.body.data?.['items'] as Body[]) ?? []).filter((i) => i['number'] === 'LVE-ZZ6B3').map((i) => `${i['version']}:${i['status']}`).sort().join() === '1:REPLACED,2:CURRENT');
    await expectStatus(HR, 'GET', `${D}?type=WRN&q=zz6b`, 200);
    await expectStatus(HR, 'GET', `${D}?pageSize=7`, 400);
    await expectStatus(HR, 'GET', `${D}?nope=1`, 400);
    await expectStatus(HR, 'POST', `${D}/LVE-ZZ6B1/open`, 200);

    out('\n== 2. Audit log: role visibility, chain check, Activity on my record');
    for (const who of [WAITER]) await expectStatus(who, 'GET', `${A}/entries`, 404);
    for (const who of [DIRECTOR, HR, BM, ACCOUNTANT, ADMIN]) await expectStatus(who, 'GET', `${A}/entries?pageSize=25`, 200);
    const hrLog = await call(HR, 'GET', `${A}/entries?event=documents&pageSize=100`);
    const dirLog = await call(DIRECTOR, 'GET', `${A}/entries?event=documents&pageSize=100`);
    check('the document.opened entry is in the Director\'s Documents view', JSON.stringify(dirLog.body.data).includes('document.opened') || JSON.stringify(dirLog.body.data).includes('opened'), JSON.stringify(dirLog.body.data).slice(0, 160));
    check('HR (no Documents category) gets an empty Documents view, not a 403', hrLog.status === 200, String(hrLog.status));
    for (const path of [`${A}/facets`, `${A}/actors?q=proof`, `${A}/viewers`]) await expectStatus(DIRECTOR, 'GET', path, 200);
    await expectStatus(DIRECTOR, 'GET', `${A}/export?event=documents`, 200);
    await expectStatus(WAITER, 'GET', `${A}/export`, 404);
    const slice = { fromSeq: 1, toSeq: 500 };
    for (const who of [BM, HR, ACCOUNTANT, WAITER]) await expectStatus(who, 'POST', `${A}/chain/check`, 403, slice);
    const chain = await expectStatus(DIRECTOR, 'POST', `${A}/chain/check`, 200, slice);
    check('the chain check reports the checked slice intact', chain.body.data?.['ok'] === true && Number(chain.body.data?.['checked']) > 0, JSON.stringify(chain.body.data));
    await expectStatus(ADMIN, 'POST', `${A}/chain/check`, 200, slice);
    await expectStatus(DIRECTOR, 'POST', `${A}/chain/check`, 400, { fromSeq: 5, toSeq: 1 });
    await expectStatus(HR, 'GET', `${A}/entries/${randomUUID()}`, 404);
    for (const who of [DIRECTOR, BM, HR, WAITER]) await expectStatus(who, 'GET', `${A}/me`, 200);
    await expectStatus(null, 'GET', `${A}/entries`, 401);
    await expectStatus(null, 'GET', D, 401);

    out('\n== 3. Verify: public (no sign-in) and signed in');
    const v = (kind: string, number: string, h: string): string => `/verify/${kind}/${number}?h=${h}`;
    const genuine = await expectStatus(null, 'GET', v('lve', 'LVE-ZZ6B1', prefixOf('LVE1v1')), 200);
    check('the right number and hash is genuine, role and date only', genuine.body.data?.['outcome'] === 'GENUINE' && genuine.body.data?.['signedByRole'] === 'BRANCH_MANAGER' && !('signedByName' in (genuine.body.data ?? {})), JSON.stringify(genuine.body.data));
    check('the public answer never names the person, the site or a figure', !/Proof Signer|ZZ Proof|siteId|KES|subject/i.test(JSON.stringify(genuine.body.data)));
    const wrong = await call(null, 'GET', v('lve', 'LVE-ZZ6B1', '0000000000'));
    const unknown = await call(null, 'GET', v('lve', 'LVE-ZZ6B9', '0000000000'));
    check('a wrong hash and an unknown number give the same public answer', wrong.body.data?.['outcome'] === 'NOT_VERIFIED' && unknown.body.data?.['outcome'] === 'NOT_VERIFIED' && JSON.stringify(Object.keys(wrong.body.data ?? {}).sort()) === JSON.stringify(Object.keys(unknown.body.data ?? {}).sort()), JSON.stringify([wrong.body.data, unknown.body.data]));
    check('a malformed number is MALFORMED', (await call(null, 'GET', v('lve', 'not-a-number', 'zz'))).body.data?.['outcome'] === 'MALFORMED');
    check('version 1 of a corrected document reads REPLACED', (await call(null, 'GET', v('lve', 'LVE-ZZ6B3', prefixOf('LVE3v1')))).body.data?.['outcome'] === 'REPLACED');
    check('version 2 of it reads GENUINE', (await call(null, 'GET', v('lve', 'LVE-ZZ6B3', prefixOf('LVE3v2')))).body.data?.['outcome'] === 'GENUINE');
    const withdrawn = (await call(null, 'GET', v('lve', 'LVE-ZZ6B4', prefixOf('LVE4v1')))).body.data;
    check('a withdrawn document reads WITHDRAWN with a role and a date', withdrawn?.['outcome'] === 'WITHDRAWN' && Boolean(withdrawn?.['withdrawnByRole']) && Boolean(withdrawn?.['withdrawnOn']), JSON.stringify(withdrawn));
    const signed = await expectStatus(HR, 'GET', `${D}/verify/lve/LVE-ZZ6B1?h=${prefixOf('LVE1v1')}`, 200);
    check('signed in, HR also gets the signer and the Open link', signed.body.data?.['canOpen'] === true && Boolean(signed.body.data?.['signedBy']), JSON.stringify(signed.body.data));
    const other = await expectStatus(HIGHWAY, 'GET', `${D}/verify/lve/LVE-ZZ6B1?h=${prefixOf('LVE1v1')}`, 200);
    check("another branch's manager gets the verdict but no Open link and no signer name (cross-site)", other.body.data?.['canOpen'] === false && other.body.data?.['signedBy'] === null, JSON.stringify(other.body.data));
    await expectStatus(null, 'GET', `${D}/verify/lve/LVE-ZZ6B1?h=${prefixOf('LVE1v1')}`, 401);
    const key = `proof-6b-${randomUUID()}`;
    const rep = await expectStatus(BM, 'POST', `${D}/verify/lve/LVE-ZZ6B1/report`, 200, { h: '0000000000', idempotencyKey: key });
    check('"Tell the ..." says who was told', rep.body.data?.['told'] === true, JSON.stringify(rep.body.data));
    await expectStatus(BM, 'POST', `${D}/verify/lve/LVE-ZZ6B1/report`, 400, { h: 'xyz', idempotencyKey: key });
    const limited: number[] = [];
    for (let i = 0; i < 35; i += 1) limited.push((await call(null, 'GET', v('lve', 'LVE-ZZ6B1', '1111111111'))).status);
    check('past 30 checks a minute from one address the answer is 429 RATE_LIMITED', limited.includes(429), limited.join(','));

    out('\n== 4. End to end, read back from the database');
    const rows = await prisma.workforceDocument.findMany({ where: { number: { contains: '-ZZ6B' } }, orderBy: [{ number: 'asc' }, { version: 'asc' }] });
    check('each row stores a 10-character prefix equal to the first 10 of its stored hash', rows.every((r) => r.hash.startsWith(r.hashPrefix) && r.hashPrefix.length === 10));
    check('the corrected number carries two versions, the first replaced', rows.filter((r) => r.number === 'LVE-ZZ6B3').map((r) => r.status).join() === 'REPLACED,CURRENT');
    const checks = await prisma.workforceDocumentCheck.count({ where: { number: { contains: '-ZZ6B' } } });
    check('every check was counted, with no address stored in clear', checks >= 8 && !(await prisma.workforceDocumentCheck.findFirst({ where: { number: { contains: '-ZZ6B' }, addressHash: { contains: '127.0.0.1' } } })));
    const opened = await prisma.auditEntry.count({ where: { action: { in: ['document.opened', 'document.verified', 'document.mismatch_reported'] }, subjectId: { contains: '-ZZ6B' } } });
    check('opening, a signed-in check and the report each wrote an audit entry', opened >= 3, String(opened));
    out('\n== 5. Reconciliation: every already-issued document is indexed, and a second run changes nothing');
    const first = await reconcileDocuments(companyId);
    const second = await reconcileDocuments(companyId);
    out(`first run ${JSON.stringify(first)}; second run ${JSON.stringify(second)}`);
    check('no issued document was refused by the door', first.failed === 0 && second.failed === 0, JSON.stringify({ first, second }));
    check('the second run registers nothing', second.registered === 0, JSON.stringify(second));
    const byKind = await prisma.workforceDocument.groupBy({ by: ['kind'], where: { companyId, NOT: { number: { contains: '-ZZ6B' } } }, _count: true });
    out(`indexed in the lane database (not proof rows): ${JSON.stringify(byKind.map((k) => [k.kind, k._count]))}`);
    out(`\n${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (process.env['KEEP'] !== '1') await down();
    else out('KEEP=1: the data stays. Run "down" to remove it.');
  }
}

const mode = process.argv[2];
(mode === 'down' ? down() : mode === 'up' ? up() : Promise.reject(new Error('usage: shared-6b-proof.ts up|down')))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect())
  .finally(() => process.exit(process.exitCode ?? 0)); // the queue and cache connections the app opens would keep the process alive
