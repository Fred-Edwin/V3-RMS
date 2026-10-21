/**
 * Workforce: Leave slips and Conduct notices on the Signed documents door, proved over HTTP against the lane API.
 * Run it AFTER `leave-proof.ts up` (against the same API) and `conduct-proof.ts up` with KEEP=1, which leave a few issued, cancelled,
 * replaced notices behind.
 *   up    probes the fresh server (the slip's QR address exists only in the new code), then calls the PUBLIC verify route (no sign-in)
 *         for every leave slip and conduct notice those proofs made, an unknown number and a wrong hash, and reads the answers back.
 *   down  removes the index rows those proofs made (run it BEFORE the two proofs' own `down`, which delete the slips and notices).
 * Usage: API=http://localhost:4105 pnpm exec tsx src/scripts/docs-door-proof.ts up|down
 */
import 'dotenv/config';
import { prisma } from '../config/database';

const API = `${process.env['API'] ?? 'http://localhost:4105'}/api/v1`;
const out = (line: string): void => void process.stdout.write(`${line}\n`);
let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, detail = ''): void => {
  if (ok) passed += 1;
  else failed += 1;
  out(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   <- ${detail}`}`);
};

type Body = Record<string, unknown>;
const get = async (path: string, token?: string): Promise<{ status: number; body: Body }> => {
  const res = await fetch(`${API}${path}`, token ? { headers: { authorization: `Bearer ${token}` } } : {});
  return { status: res.status, body: ((await res.json().catch(() => ({}))) as { data?: Body }).data ?? {} };
};
const PUBLIC_KEYS = ['outcome', 'kind', 'number', 'documentLabel', 'version', 'periodLabel', 'signedByRole', 'signedOn', 'replacedByNumber', 'replacedByVersion', 'replacedOn', 'withdrawnOn', 'withdrawnByRole', 'checkedAt', 'employerName'];
const EXPECTED: Record<string, string> = { CURRENT: 'GENUINE', REPLACED: 'REPLACED', WITHDRAWN: 'WITHDRAWN' };

async function proofDocuments(): Promise<{ applicationIds: string[]; noticeIds: string[]; rows: Awaited<ReturnType<typeof prisma.workforceDocument.findMany>> }> {
  const employees = await prisma.employee.findMany({ where: { OR: [{ name: { startsWith: 'ZZ Proof Leave' } }, { name: { startsWith: 'ZZ Proof 5' } }] }, select: { id: true } });
  const ids = employees.map((e) => e.id);
  const applicationIds = (await prisma.leaveApplication.findMany({ where: { employeeId: { in: ids } }, select: { id: true } })).map((a) => a.id);
  const noticeIds = (await prisma.conductNotice.findMany({ where: { employeeId: { in: ids } }, select: { id: true } })).map((n) => n.id);
  const where = { OR: [...applicationIds, ...noticeIds].map((id) => ({ openHref: { contains: id } })) };
  const rows = applicationIds.length + noticeIds.length === 0 ? [] : await prisma.workforceDocument.findMany({ where, orderBy: [{ number: 'asc' }, { version: 'asc' }] });
  return { applicationIds, noticeIds, rows };
}

async function down(): Promise<void> {
  const { rows } = await proofDocuments();
  const removed = await prisma.workforceDocument.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  out(`removed ${removed.count} index rows`);
}

async function up(): Promise<void> {
  out('== 0. is the server on this port running the new code?');
  const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'proof.lv.manager@wendo.test', password: 'password123' }) });
  const token = ((await login.json()) as { data?: { accessToken?: string } }).data?.accessToken;
  check('the leave proof manager signs in', Boolean(token), `status ${login.status}`);
  const { applicationIds, noticeIds, rows } = await proofDocuments();
  check('the proofs left leave slips and conduct notices to check', applicationIds.length > 0 && noticeIds.length > 0, `${applicationIds.length} requests, ${noticeIds.length} notices`);
  const lve = rows.filter((r) => r.kind === 'LVE');
  const wrn = rows.filter((r) => r.kind === 'WRN');
  check('the index holds LVE and WRN rows from the proofs', lve.length > 0 && wrn.length > 0, `${lve.length} LVE, ${wrn.length} WRN`);

  const probeApp = await prisma.leaveApplication.findFirst({ where: { id: { in: applicationIds }, slipNumber: { not: null } }, select: { id: true, slipNumber: true } });
  const slip = probeApp ? await get(`/workforce/leave/applications/${probeApp.id}/slip`, token) : null;
  const qrUrl = String(slip?.body['qrUrl'] ?? '');
  check('fresh server: the slip QR is /verify/lve/LVE-nnnn?h=<10 hex>', /\/verify\/lve\/LVE-\d{4,}\?h=[0-9a-f]{10}$/.test(qrUrl), qrUrl);
  const probeRow = lve.find((r) => probeApp && r.openHref.includes(probeApp.id));
  check('the QR hash is the index hash', Boolean(probeRow) && qrUrl.endsWith(`?h=${probeRow?.hashPrefix}`), `${qrUrl} vs ${probeRow?.hashPrefix}`);

  out('\n== 1. the public verify route, no sign-in');
  for (const row of [...lve, ...wrn]) {
    const reply = await get(`/verify/${row.kind.toLowerCase()}/${row.number}?h=${row.hashPrefix}`);
    const keys = Object.keys(reply.body);
    check(`${row.number} v${row.version} (${row.status}) reads ${EXPECTED[row.status]}`, reply.status === 200 && reply.body['outcome'] === EXPECTED[row.status], `${reply.status} ${JSON.stringify(reply.body).slice(0, 160)}`);
    check(`${row.number} v${row.version} answers role and date only`, keys.every((k) => PUBLIC_KEYS.includes(k)) && !JSON.stringify(reply.body).includes('ZZ Proof'), keys.join(','));
  }
  const outcomes = (kind: string): string[] => rows.filter((r) => r.kind === kind).map((r) => EXPECTED[r.status] as string);
  check('a genuine slip, a voided slip', outcomes('LVE').includes('GENUINE') && outcomes('LVE').includes('WITHDRAWN'), outcomes('LVE').join(','));
  check('a genuine notice and a replaced version', outcomes('WRN').includes('GENUINE') && outcomes('WRN').includes('REPLACED'), outcomes('WRN').join(','));

  out('\n== 2. unknown and wrong');
  const first = lve[0];
  const unknown = await get(`/verify/lve/LVE-99999?h=${first?.hashPrefix ?? '0000000000'}`);
  check('an unknown slip number is NOT_VERIFIED', unknown.body['outcome'] === 'NOT_VERIFIED', JSON.stringify(unknown.body));
  const unknownWrn = await get(`/verify/wrn/WRN-99999?h=${wrn[0]?.hashPrefix ?? '0000000000'}`);
  check('an unknown notice number is NOT_VERIFIED', unknownWrn.body['outcome'] === 'NOT_VERIFIED', JSON.stringify(unknownWrn.body));
  const wrong = await get(`/verify/wrn/${wrn[0]?.number}?h=0000000000`);
  check('a wrong hash is the same answer as unknown', wrong.body['outcome'] === 'NOT_VERIFIED', JSON.stringify(wrong.body));
  const old = await get(`/verify/lve/${first?.number}?c=abcdef123456`);
  check('the old ?c= address is MALFORMED, never genuine', old.body['outcome'] === 'MALFORMED', JSON.stringify(old.body));
}

const mode = process.argv[2];
(mode === 'down' ? down() : mode === 'up' ? up() : Promise.reject(new Error('Usage: docs-door-proof.ts up|down')))
  .then(async () => {
    out(`\n${passed} passed, ${failed} failed.`);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  })
  .catch(async (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    await prisma.$disconnect();
    process.exit(1);
  });
