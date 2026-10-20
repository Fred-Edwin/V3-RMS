/**
 * Workforce Segment 3: the payslips and casual pay proof, over HTTP with the real seeded logins against the lane database.
 * The app is served inside this process (the same Express app and the same middleware the API runs) so a fixture month can be marked
 * published through the publication seam: Payroll part 2 is not merged in this lane, and part 1's month states cannot say "published".
 *   up    makes a fixture (a waiter with two published months and a corrected one, a CASUAL_WORK rate), walks every role through
 *         the payslip code, the staff reads, the A4 file, HR's opening, the Director's count, the P9 gate and the whole casual day,
 *         then (unless KEEP=1) removes what it made. With KEEP=1 the data stays for inspection with the Postgres MCP.
 *   down  removes everything `up` made and puts the real accounts' PINs back.
 * Usage: RATE_LIMIT_MAX=100000 pnpm exec tsx src/scripts/payslips-casual-proof.ts up|down     (KEEP=1 to keep the data)
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { app } from '../app';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { addDays, setPublicationSource, setWorkforceNotifier, toDateColumn, type NairobiDate } from '../modules/workforce';
import { hashPassword, hashPin } from '../utils/password';

const TAG = 'ZZ Proof Slip';
const PASSWORD = 'password123';
const PIN = '4321';
const STATE = process.env['PROOF_STATE'] ?? '/tmp/claude-1000/slips-proof-pins.json';
const out = (line: string): void => void process.stdout.write(`${line}\n`);
let passed = 0;
let failed = 0;
const check = (label: string, ok: boolean, detail = ''): void => {
  if (ok) passed += 1;
  else failed += 1;
  out(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `   <- ${detail}`}`);
};

type Body = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- the proof reads loose JSON
type Reply = { status: number; body: { success?: boolean; data?: Body; error?: { code?: string; message?: string; details?: Body } }; headers: Headers; bytes: Buffer };
let base = '';
const tokens = new Map<string, string>();
const login = async (email: string): Promise<void> => {
  const res = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  if (!json.data?.accessToken) throw new Error(`login failed for ${email}`);
  tokens.set(email, json.data.accessToken);
};
const call = async (who: string, method: string, path: string, body?: object, headers: Record<string, string> = {}): Promise<Reply> => {
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.get(who)}`, ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const bytes = Buffer.from(await res.arrayBuffer());
  let parsed: Reply['body'] = {};
  try {
    parsed = JSON.parse(bytes.toString('utf8')) as Reply['body'];
  } catch {
    /* a PDF */
  }
  return { status: res.status, body: parsed, headers: res.headers, bytes };
};
const short = (path: string): string => (path.split('?')[0] ?? path).replace('/workforce/', '').replace(/[0-9a-f-]{36}/g, ':id');
const expectStatus = async (who: string, method: string, path: string, expected: number, body?: object, headers?: Record<string, string>): Promise<Reply> => {
  const r = await call(who, method, path, body, headers);
  check(`${who.split('@')[0]} ${method} ${short(path)} -> ${expected}`, r.status === expected, `got ${r.status} ${JSON.stringify(r.body).slice(0, 220)}`);
  return r;
};
const expectCode = async (who: string, method: string, path: string, expected: number, code: string, body?: object, headers?: Record<string, string>): Promise<Reply> => {
  const r = await call(who, method, path, body, headers);
  check(`${who.split('@')[0]} ${method} ${short(path)} -> ${expected} ${code}`, r.status === expected && r.body.error?.code === code, `got ${r.status} ${JSON.stringify(r.body).slice(0, 220)}`);
  return r;
};

const HR = 'hr@wendo.test';
const ADMIN = 'admin@wendo.test';
const BM = 'bm.town@wendo.test';
const HIGHWAY = 'bm.highway@wendo.test';
const DIRECTOR = 'director@wendo.test';
const ACCOUNTANT = 'accountant@wendo.test';
const KITCHEN_HEAD = 'kitchen.head.town@wendo.test';
const BARISTA_HEAD = 'barista.head.town@wendo.test';
const ATTENDANT = 'store.attendant@wendo.test';
const WAITER = `zz.proof.slip.waiter@wendo.test`;
const REAL_PINS = [BM, HIGHWAY, DIRECTOR, ACCOUNTANT, KITCHEN_HEAD, BARISTA_HEAD, ATTENDANT, ADMIN];
const P = '/workforce/payslips';
const C = '/workforce/casuals';
let keys = 0;
const key = (label: string): string => `proof-${label}-${Date.now()}-${(keys += 1)}`;
const DEVICE = `proof-phone-${randomUUID().slice(0, 8)}`;

async function restorePins(): Promise<void> {
  if (!existsSync(STATE)) return;
  const saved = JSON.parse(readFileSync(STATE, 'utf8')) as Record<string, string | null>;
  for (const [email, hash] of Object.entries(saved)) await prisma.user.update({ where: { email }, data: { pinHash: hash } }).catch(() => undefined);
}

async function down(): Promise<void> {
  const users = await prisma.user.findMany({ where: { email: { startsWith: 'zz.proof.slip.' } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const employees = (await prisma.employee.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((e) => e.id);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('wendo.allow_payroll_edit', 'on', true)`;
    await tx.$executeRaw`SELECT set_config('wendo.allow_payslip_edit', 'on', true)`;
    const months = await tx.payrollMonth.findMany({ where: { monthKey: { in: ['2024-11', '2024-12'] }, includedSiteIds: { isEmpty: false } }, select: { id: true } });
    const slips = (await tx.payrollPayslip.findMany({ where: { employeeId: { in: employees } }, select: { id: true } })).map((s) => s.id);
    await tx.payslipDocument.deleteMany({ where: { payslipId: { in: slips } } });
    await tx.p9Document.deleteMany({ where: { employeeId: { in: employees } } });
    await tx.payslipCodeTry.deleteMany({ where: { userId: { in: userIds } } });
    await tx.payrollMonth.deleteMany({ where: { id: { in: months.map((m) => m.id) }, runs: { some: { payslips: { some: { employeeId: { in: employees } } } } } } });
  });
  const sheets = await prisma.casualSheet.findMany({ where: { lines: { some: { worker: { fullName: { startsWith: TAG } } } } }, select: { id: true } });
  await prisma.casualSheet.deleteMany({ where: { id: { in: sheets.map((s) => s.id) } } });
  await prisma.casualWorker.deleteMany({ where: { fullName: { startsWith: TAG } } });
  await prisma.casualRequestKey.deleteMany({ where: { key: { startsWith: 'proof-' } } });
  await prisma.payslipUnlock.deleteMany({});
  await prisma.payslipOpenDigest.deleteMany({});
  const attendant = await prisma.user.findUnique({ where: { email: ATTENDANT }, select: { id: true } });
  await prisma.payslip.deleteMany({ where: { userId: attendant?.id ?? '', payPeriod: '2026-08', grossPay: 1234 } });
  await prisma.ruleVersion.deleteMany({ where: { reason: `${TAG} rate` } });
  await prisma.p9FormatConfirmation.deleteMany({ where: { layoutVersion: 1, confirmedById: (await prisma.user.findUnique({ where: { email: ACCOUNTANT }, select: { id: true } }))?.id ?? '' } });
  await prisma.payProfile.deleteMany({ where: { employeeId: { in: employees } } });
  await prisma.employee.deleteMany({ where: { id: { in: employees } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await restorePins();
  out('Removed the proof data and restored the PINs. The audit entries stay: the log is append-only.');
}

async function up(): Promise<void> {
  const notes: { to: string; kind: string }[] = [];
  setWorkforceNotifier({ notify: async (to, kind) => void notes.push({ to, kind }) });
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}${env.API_PREFIX}`;
  try {
    out('== 0. fixture');
    const town = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { id: true, siteId: true, site: { select: { companyId: true, name: true } } } });
    const companyId = town.site!.companyId;
    const siteId = town.siteId!;
    const saved: Record<string, string | null> = {};
    const pinHash = await hashPin(PIN);
    for (const email of REAL_PINS) {
      const u = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, pinHash: true } });
      saved[email] = u.pinHash;
      await prisma.user.update({ where: { id: u.id }, data: { pinHash } });
    }
    if (!existsSync(STATE)) writeFileSync(STATE, JSON.stringify(saved)); // never overwrite a backup: a second run would save the proof's own PINs as the originals
    const id = async (email: string) => (await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })).id;
    const accountantId = await id(ACCOUNTANT);
    const waiterUser = await prisma.user.create({ data: { name: `${TAG} Waiter`, email: WAITER, passwordHash: await hashPassword(PASSWORD), pinHash, role: 'WAITER', siteId } });
    const employee = await prisma.employee.create({ data: { companyId, siteId, userId: waiterUser.id, employeeNumber: 'ZZPS-0214', name: `${TAG} Waiter`, payType: 'MONTHLY_SALARY', startDate: toDateColumn('2024-11-01' as NairobiDate), status: 'ACTIVE', kraPin: 'A001234567Z', nssfNumber: '123456789', shaNumber: '987654321' } });
    await prisma.payProfile.create({ data: { employeeId: employee.id, amount: '50000', payoutMethod: 'BANK', bankName: 'Equity', accountNumber: '0123456789124412' } });
    const ids = new Set<string>();
    const paid = new Map<string, string>();
    for (const [monthKey, versions] of [['2024-11', [{ net: '38000.00', late: '0.00' }]], ['2024-12', [{ net: '37795.00', late: '410.00' }, { net: '38000.00', late: '205.00' }]]] as const) {
      const month = await prisma.payrollMonth.create({ data: { companyId, monthKey, state: 'TO_PUBLISH', stateVersion: 1, includedSiteIds: [siteId], approvedAt: new Date('2025-01-02T10:00:00Z'), approvedById: accountantId, documentNumber: `PAY-${monthKey}`, rulesUsed: {} } }).catch(async () => prisma.payrollMonth.findFirstOrThrow({ where: { companyId, monthKey } }));
      const run = await prisma.payrollRun.create({ data: { monthId: month.id, runNumber: 1, trigger: 'SYSTEM', status: 'SUCCEEDED', inputsHash: 'x', headcount: 1, totals: {} } });
      await prisma.payrollMonth.update({ where: { id: month.id }, data: { currentRunId: run.id } });
      for (const [i, v] of versions.entries()) {
        await prisma.payrollPayslip.create({
          data: {
            monthId: month.id, runId: run.id, employeeId: employee.id, siteId, version: i + 1, employeeName: `${TAG} Waiter`, employeeNumber: 'ZZPS-0214', department: 'Service', siteName: town.site!.name, basic: '50000.00', gross: '50000.00',
            statutoryEmployee: '8000.00', incomeTax: '6000.00', otherDeductions: v.late, net: v.net, employerShare: '1080.00', taxablePay: '48000.00', overtimePay: '0.00', latenessDeduction: v.late, unpaidAbsence: '0.00', input: {},
            documentNumber: monthKey === '2024-12' ? 'PS-0987' : 'PS-0986', ...(i > 0 ? { replacesVersion: i, correctedAt: new Date('2025-01-20T07:15:00Z'), correctedById: accountantId, reason: 'fixture' } : {}),
            lines: { create: [
              { position: 1, code: 'BASIC', label: 'Basic pay', kind: 'EARNING', amount: '50000.00', taxable: true, source: {}, workingText: 'Monthly rate' },
              { position: 2, code: 'NSSF', label: 'NSSF', kind: 'STATUTORY', amount: '2000.00', share: 'EMPLOYEE', source: {}, workingText: 'Tier I and II' },
              { position: 3, code: 'PAYE', label: 'PAYE', kind: 'STATUTORY', amount: '6000.00', share: 'EMPLOYEE', source: {}, workingText: 'After relief' },
              { position: 4, code: 'LATE', label: 'Lateness', kind: 'DEDUCTION', amount: v.late, source: {}, workingText: 'Minutes late' },
              { position: 5, code: 'NSSF_ER', label: 'NSSF, employer share', kind: 'MEMO', amount: '1080.00', share: 'EMPLOYER', source: {}, workingText: '' },
            ] },
          },
        });
      }
      ids.add(month.id);
    }
    setPublicationSource(async (months) => new Map(months.map((m) => [m.id, { published: ids.has(m.id), paid: paid.has(m.id), payDay: null, paidOn: (paid.get(m.id) as NairobiDate | undefined) ?? null }])));
    await prisma.ruleVersion.create({ data: { companyId, siteId: null, group: 'CASUAL_WORK', version: ((await prisma.ruleVersion.aggregate({ where: { companyId, siteId: null, group: 'CASUAL_WORK' }, _max: { version: true } }))._max.version ?? 0) + 1, effectiveFrom: toDateColumn('2026-01-01' as NairobiDate), values: { defaultDailyRate: '900', rates: [], pettyCashHolder: { mode: 'BRANCH_MANAGER' }, latenessReducesPayout: true }, reason: `${TAG} rate`, createdById: accountantId, createdByRole: 'DIRECTOR' } });
    const attendantRow = await prisma.user.findUniqueOrThrow({ where: { email: ATTENDANT }, select: { id: true, siteId: true } });
    await prisma.payslip.create({ data: { siteId: attendantRow.siteId!, userId: attendantRow.id, payPeriod: '2026-08', payDate: new Date('2026-08-28'), grossPay: 1234, paye: 1, sha: 1, nssfTier1: 1, nssfTier2: 1, housingLevy: 1, totalDeductions: 4, netPay: 1230, isLocked: true, createdById: attendantRow.id } });
    const kitchen = await prisma.employee.findFirstOrThrow({ where: { user: { email: KITCHEN_HEAD } }, select: { departmentId: true } });
    const deptId = kitchen.departmentId!;
    const logins = [WAITER, ATTENDANT, KITCHEN_HEAD, BARISTA_HEAD, BM, HIGHWAY, HR, ACCOUNTANT, DIRECTOR, ADMIN];
    for (const email of logins) await login(email);
    check('ten real logins work', tokens.size === 10);

    out('\n== 1. the payslip code (a waiter)');
    const phone = { 'x-device-id': DEVICE };
    const list = await expectStatus(WAITER, 'GET', `${P}/me`, 200, undefined, phone);
    check('the list has the two published months and no amount anywhere', list.body.data?.['items']?.length === 2 && !/"(gross|net|amount)"/.test(JSON.stringify(list.body)));
    await expectCode(WAITER, 'GET', `${P}/me/home`, 403, 'UNLOCK_REQUIRED', undefined, phone);
    for (let tries = 0; tries < 2; tries += 1) await expectCode(WAITER, 'POST', `${P}/me/unlock`, 403, 'CODE_WRONG', { code: '0000', deviceId: DEVICE });
    check('two wrong tries raise no alert yet', notes.filter((n) => n.kind === 'payslip.three_wrong_codes').length === 0);
    await expectCode(WAITER, 'POST', `${P}/me/unlock`, 403, 'CODE_WRONG', { code: '0000', deviceId: DEVICE });
    check('the third wrong try tells the System Admin and the person', notes.filter((n) => n.kind === 'payslip.three_wrong_codes').some((n) => n.to === waiterUser.id) && notes.filter((n) => n.kind === 'payslip.three_wrong_codes').length >= 2);
    const open = await expectStatus(WAITER, 'POST', `${P}/me/unlock`, 200, { code: PIN, deviceId: DEVICE });
    const unlocked = { ...phone, 'x-payslip-unlock': String(open.body.data?.['unlockToken']) };
    const home = await expectStatus(WAITER, 'GET', `${P}/me/home`, 200, undefined, unlocked);
    check('home: the newest month is December, version 2, net 38,000', home.body.data?.['latest']?.month === '2024-12' && home.body.data?.['latest']?.net === '38000.00' && home.body.data?.['latest']?.versionNumber === 2);
    const payslipId = String(home.body.data?.['latest']?.id);
    const detail = await expectStatus(WAITER, 'GET', `${P}/me/${payslipId}`, 200, undefined, unlocked);
    check('the corrected line says "corrected from 410.00"', detail.body.data?.['thisMonth']?.deductions?.some((l: Body) => l.key === 'LATE' && l.correctedFrom === '410.00') === true);
    const file1 = await call(WAITER, 'GET', `${P}/me/${payslipId}/document?purpose=download`, undefined, unlocked);
    const file2 = await call(WAITER, 'GET', `${P}/me/${payslipId}/document?purpose=view`, undefined, unlocked);
    check('the A4 file is a PDF, inline, never cached, the same bytes twice', file1.status === 200 && file1.bytes.subarray(0, 4).toString() === '%PDF' && file1.headers.get('cache-control') === 'private, no-store' && file1.bytes.equals(file2.bytes));
    await expectStatus(WAITER, 'GET', `${P}/me/${payslipId}?v=1`, 200, undefined, unlocked);
    await expectStatus(WAITER, 'POST', `${P}/me/lock`, 200, { deviceId: DEVICE });
    await expectCode(WAITER, 'GET', `${P}/me/home`, 403, 'UNLOCK_REQUIRED', undefined, unlocked);

    out('\n== 2. nobody reads another person\'s payslip');
    const att = await expectStatus(ATTENDANT, 'GET', `${P}/me`, 200, undefined, phone);
    check('a different person sees none of it, and the old-payslip card instead', att.body.data?.['items']?.length === 0 && att.body.data?.['legacy']?.card === true && att.body.data?.['legacyAvailable'] === true);
    const attOpen = await expectStatus(ATTENDANT, 'POST', `${P}/me/unlock`, 200, { code: PIN, deviceId: DEVICE });
    const attHeaders = { ...phone, 'x-payslip-unlock': String(attOpen.body.data?.['unlockToken']) };
    await expectStatus(ATTENDANT, 'GET', `${P}/me/${payslipId}`, 404, undefined, attHeaders);
    await expectStatus(ATTENDANT, 'GET', `${P}/me/${payslipId}/document`, 404, undefined, attHeaders);
    await expectCode(WAITER, 'GET', `${P}/me/${payslipId}`, 403, 'UNLOCK_REQUIRED', undefined, attHeaders); // a stolen token is no use to anyone else
    await expectStatus(ADMIN, 'GET', `${P}/me`, 403);
    await expectStatus(ADMIN, 'POST', `${P}/me/unlock`, 403, { code: PIN, deviceId: DEVICE });

    out('\n== 3. who may open anyone\'s payslip');
    for (const who of [HR, ACCOUNTANT]) await expectStatus(who, 'GET', `${P}/${payslipId}`, 200);
    await expectStatus(HR, 'GET', `${P}/${payslipId}/document`, 200);
    for (const who of [WAITER, ATTENDANT, KITCHEN_HEAD, BM, HIGHWAY, DIRECTOR, ADMIN]) await expectStatus(who, 'GET', `${P}/${payslipId}`, 403);
    await expectStatus(HR, 'GET', `${P}/${randomUUID()}`, 404);
    const day = new Date().toISOString().slice(0, 10);
    const opens = await expectStatus(DIRECTOR, 'GET', `${P}/opens?day=${day}`, 200);
    check('the Director sees HR and the Accountant counted for the day', (opens.body.data as unknown as Body[] | undefined)?.some((r) => r['role'] === 'HR_MANAGER' && r['count'] >= 2) === true);
    for (const who of [HR, ACCOUNTANT, ADMIN, BM]) await expectStatus(who, 'GET', `${P}/opens?day=${day}`, 403);
    check('the Director was told once for HR', notes.filter((n) => n.kind === 'payslip.opened_by_staff').length >= 1);

    out('\n== 4. the P9');
    const st0 = await expectStatus(WAITER, 'GET', `${P}/me/p9/2024`, 200);
    check('December not paid: NOT_YET', st0.body.data?.['status'] === 'NOT_YET');
    const decId = (await prisma.payrollMonth.findFirstOrThrow({ where: { companyId, monthKey: '2024-12' } })).id;
    paid.set(decId, '2024-12-23');
    const st1 = await expectStatus(WAITER, 'GET', `${P}/me/p9/2024`, 200);
    check('December paid: waits for the Accountant\'s format check', st1.body.data?.['status'] === 'WAITING_FORMAT');
    const relock = await expectStatus(WAITER, 'POST', `${P}/me/unlock`, 200, { code: PIN, deviceId: DEVICE });
    const w2 = { ...phone, 'x-payslip-unlock': String(relock.body.data?.['unlockToken']) };
    await expectCode(WAITER, 'GET', `${P}/me/p9/2024/document`, 409, 'P9_NOT_AVAILABLE', undefined, w2);
    await expectStatus(HR, 'POST', `${P}/p9/format/confirm`, 403, { pin: PIN });
    await expectCode(ACCOUNTANT, 'POST', `${P}/p9/format/confirm`, 403, 'PIN_INVALID', { pin: '0000' });
    await expectStatus(ACCOUNTANT, 'POST', `${P}/p9/format/confirm`, 200, { pin: PIN });
    const p9a = await call(WAITER, 'GET', `${P}/me/p9/2024/document`, undefined, w2);
    const p9b = await call(WAITER, 'GET', `${P}/me/p9/2024/document`, undefined, w2);
    check('the P9 is a PDF and the same card every time', p9a.status === 200 && p9a.bytes.subarray(0, 4).toString() === '%PDF' && p9a.bytes.equals(p9b.bytes));
    await expectStatus(HR, 'POST', `${P}/p9/2024/people/${employee.id}/generate`, 200);
    await expectStatus(BM, 'POST', `${P}/p9/2024/people/${employee.id}/generate`, 403);

    out('\n== 5. casual pay: a department head records a day');
    const yesterday = addDays(new Date().toISOString().slice(0, 10) as NairobiDate, -1);
    const person = async (name: string, nid: string) => (await call(KITCHEN_HEAD, 'POST', `${C}/people`, { fullName: `${TAG} ${name}`, nationalId: nid, nationalIdConfirm: nid, idempotencyKey: key('person') })).body.data as Body;
    const peter = await person('Peter Mwangi', 'ZP900001');
    const rose = await person('Rose Wanjiru', 'ZP900002');
    check('two casuals added, ID numbers masked', Boolean(peter['id'] && rose['id']) && /•/.test(String(peter['idMasked'])));
    await expectCode(BARISTA_HEAD, 'POST', `${C}/people`, 409, 'CASUAL_EXISTS', { fullName: `${TAG} Peter Again`, nationalId: 'ZP900001', nationalIdConfirm: 'ZP900001', idempotencyKey: key('person') });
    const lines = [{ casualId: peter['id'], start: '07:00', end: '15:00' }, { casualId: rose['id'], start: '10:00', end: '19:00' }];
    const k = key('lines');
    const put = (version: number, who = KITCHEN_HEAD, idem = k) => call(who, 'PUT', `${C}/sheets/lines`, { siteId, departmentId: deptId, date: yesterday, version, idempotencyKey: idem, lines });
    const first = await put(0);
    check('saved: 900 + 1,013 = 1,913 (9 hours is 900 + an eighth, rounded up)', first.status === 200 && first.body.data?.['total'] === '1913.00', JSON.stringify(first.body).slice(0, 200));
    const sheetId = String(first.body.data?.['id']);
    const retry = await put(0);
    check('the phone never heard: the same key makes one sheet, the same version', retry.status === 200 && retry.body.data?.['version'] === first.body.data?.['version']);
    check('a stale version is refused', (await put(0, KITCHEN_HEAD, key('lines'))).body.error?.code === 'CHANGED_UNDERNEATH');
    await expectStatus(WAITER, 'PUT', `${C}/sheets/lines`, 403, { siteId, departmentId: deptId, date: yesterday, version: 0, idempotencyKey: key('lines'), lines: [] });
    await expectStatus(BM, 'PUT', `${C}/sheets/lines`, 403, { siteId, departmentId: deptId, date: yesterday, version: 0, idempotencyKey: key('lines'), lines: [] });
    await expectStatus(BARISTA_HEAD, 'GET', `${C}/sheets/${sheetId}`, 404);
    await expectStatus(HIGHWAY, 'GET', `${C}/sheets/${sheetId}`, 404);
    await expectStatus(ADMIN, 'GET', `${C}/sheets/${sheetId}`, 403);
    await expectStatus(WAITER, 'GET', `${C}/sheets/${sheetId}`, 403);
    for (const who of [BM, HR, ACCOUNTANT, DIRECTOR]) await expectStatus(who, 'GET', `${C}/sheets/${sheetId}`, 200);
    const preview = await call(KITCHEN_HEAD, 'GET', `${C}/sheets/${sheetId}/preview`);
    check('the preview is a draft PDF', preview.status === 200 && preview.bytes.subarray(0, 4).toString() === '%PDF');
    const version1 = Number(first.body.data?.['version']);
    const sent = await expectStatus(KITCHEN_HEAD, 'POST', `${C}/sheets/${sheetId}/send`, 200, { version: version1, idempotencyKey: key('send') });
    check('sent: the Branch Manager is told', notes.some((n) => n.kind === 'casual.sent'));
    const v2 = Number(sent.body.data?.['version']);

    out('\n== 6. the Branch Manager decides');
    const wait = await expectStatus(BM, 'GET', `${C}/sheets/waiting`, 200);
    check('the sheet is waiting for the Branch Manager', (wait.body.data?.['toApprove'] as Body[] | undefined)?.some((c) => c['id'] === sheetId) === true);
    await expectStatus(KITCHEN_HEAD, 'GET', `${C}/sheets/waiting`, 403);
    for (const who of [HR, ACCOUNTANT]) await expectStatus(who, 'POST', `${C}/sheets/${sheetId}/approve`, 403, { pin: PIN, version: v2, expectedTotal: '1913.00', idempotencyKey: key('approve') });
    await expectStatus(HIGHWAY, 'POST', `${C}/sheets/${sheetId}/approve`, 404, { pin: PIN, version: v2, expectedTotal: '1913.00', idempotencyKey: key('approve') });
    await expectCode(BM, 'POST', `${C}/sheets/${sheetId}/approve`, 403, 'PIN_INVALID', { pin: '0000', version: v2, expectedTotal: '1913.00', idempotencyKey: key('approve') });
    await expectCode(BM, 'POST', `${C}/sheets/${sheetId}/approve`, 409, 'CHANGED_UNDERNEATH', { pin: PIN, version: v2, expectedTotal: '1.00', idempotencyKey: key('approve') });
    const ak = key('approve');
    const approved = await expectStatus(BM, 'POST', `${C}/sheets/${sheetId}/approve`, 200, { pin: PIN, version: v2, expectedTotal: '1913.00', idempotencyKey: ak });
    const again = await call(BM, 'POST', `${C}/sheets/${sheetId}/approve`, { pin: PIN, version: v2, expectedTotal: '1913.00', idempotencyKey: ak });
    check('approved with a CPS number; the retry gives the same number', /^CPS-\d{4}$/.test(String(approved.body.data?.['number'])) && again.body.data?.['number'] === approved.body.data?.['number']);
    check('the head and the cash holder were told, with no figure', notes.some((n) => n.kind === 'casual.approved') && JSON.stringify(notes).indexOf('1913') === -1);
    const doc = await call(BM, 'GET', `${C}/sheets/${sheetId}/document`);
    check('the approved sheet is a PDF named for its number', doc.status === 200 && String(doc.headers.get('content-disposition')).includes(String(approved.body.data?.['number'])));

    out('\n== 7. workers sign, the month summary, void and corrections');
    const lineId = String((approved.body.data?.['lines'] as Body[]).find((l) => l['casualId'] === peter['id'])?.['id']);
    await expectStatus(KITCHEN_HEAD, 'POST', `${C}/sheets/${sheetId}/lines/${lineId}/receive`, 200, { name: `${TAG} Peter Mwangi`, idempotencyKey: key('receive') });
    await expectCode(KITCHEN_HEAD, 'POST', `${C}/sheets/${sheetId}/lines/${lineId}/receive`, 409, 'ALREADY_RECEIVED', { name: `${TAG} Peter Mwangi`, idempotencyKey: key('receive') });
    const signedSheet = await call(BM, 'GET', `${C}/sheets/${sheetId}`);
    await expectCode(BM, 'POST', `${C}/sheets/${sheetId}/void`, 409, 'ALREADY_SIGNED', { reason: 'Recorded on the wrong day', pin: PIN, version: Number(signedSheet.body.data?.['version']), idempotencyKey: key('void') });
    const month = yesterday.slice(0, 7);
    const summary = await expectStatus(ACCOUNTANT, 'GET', `${C}/months/${month}/summary`, 200);
    check('the month summary counts the approved sheet', Number(summary.body.data?.['paidTotal']) >= 1913 && summary.body.data?.['source'] === 'SHEETS');
    await expectStatus(BM, 'GET', `${C}/months/${month}/summary`, 403);
    const todayDate = new Date().toISOString().slice(0, 10);
    const today = await call(KITCHEN_HEAD, 'PUT', `${C}/sheets/lines`, { siteId, departmentId: deptId, date: todayDate, version: 0, idempotencyKey: key('lines'), lines: [{ casualId: peter['id'], start: '00:00', end: '01:00' }] });
    const corrected = await call(KITCHEN_HEAD, 'POST', `${C}/sheets/${String(today.body.data?.['id'])}/corrections`, { casualId: peter['id'], originalDate: yesterday, amount: '-100', reason: 'Peter left an hour early', version: Number(today.body.data?.['version']), idempotencyKey: key('corr') });
    check('a correction line goes on a later sheet and lowers its total', corrected.status === 201 && Number(corrected.body.data?.['total']) === Number(today.body.data?.['total']) - 100, JSON.stringify(corrected.body).slice(0, 200));

    out('\n== 8. integrity');
    const mine = await prisma.auditEntry.findMany({ where: { OR: [{ action: { startsWith: 'payslip.' } }, { action: { startsWith: 'casual.' } }, { action: { startsWith: 'p9.' } }] }, orderBy: { seq: 'desc' }, take: 200 });
    check('no audit entry of this segment carries a figure, a code or a PIN', mine.every((e) => !/"(amount|gross|net|total|pin|code)"/.test(JSON.stringify([e.before, e.after]))));
    const tries = await prisma.payslipCodeTry.findMany({ where: { userId: waiterUser.id } });
    check('every code try is recorded: 3 wrong, then right', tries.filter((t) => !t.success).length === 3 && tries.some((t) => t.success));
    out(`\n${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    setPublicationSource(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (process.env['KEEP'] !== '1') await down();
    else out('KEEP=1: the data stays. Run "down" to remove it.');
  }
}

const mode = process.argv[2];
(mode === 'down' ? down() : mode === 'up' ? up() : Promise.reject(new Error('usage: payslips-casual-proof.ts up|down')))
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
