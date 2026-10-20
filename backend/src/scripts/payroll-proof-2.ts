/**
 * Workforce Segment 2B: the Payroll part 2 proof over HTTP with the real seeded logins, against the lane database and the lane API.
 * It continues part 1's proof: run `timesheets-proof.ts up`, then `payroll-proof.ts up` (which leaves September approved, "To
 * publish"), then this. It walks the rest of the month for every role: publish (refusals first), the pay-out card, the bank file,
 * a correction (version 2, the file voided, a new download), Mark as paid with the current file, every write refused after it, all
 * exports downloaded and opened, the clock switched off, the audit chain. The figures are compared with a hand calculation written
 * independently here. It leaves the data for inspection (read it with the Postgres MCP); then run `payroll-proof.ts down` and
 * `timesheets-proof.ts down`.
 * Usage: API=http://localhost:4101 PROOF_OUT=/some/dir pnpm exec tsx src/scripts/payroll-proof-2.ts
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { prisma } from '../config/database';
import { verifyAuditChain, type AuditCategoryCode, type AuditEntryRecord } from '../modules/workforce';

const API = `${process.env['API'] ?? 'http://localhost:4101'}/api/v1`;
const OUT = process.env['PROOF_OUT'];
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
type Reply = { status: number; body: { success?: boolean; data?: Body; error?: { code?: string; message?: string } } };
const tokens = new Map<string, string>();
const login = async (email: string): Promise<void> => {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  if (!json.data?.accessToken) throw new Error(`login failed for ${email}`);
  tokens.set(email, json.data.accessToken);
};
const send = (who: string, method: string, path: string, body?: object) => fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.get(who)}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
const call = async (who: string, method: string, path: string, body?: object): Promise<Reply> => {
  const res = await send(who, method, path, body);
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Reply['body'] };
};
const raw = async (who: string, method: string, path: string, body?: object) => {
  const res = await send(who, method, path, body);
  return { status: res.status, headers: res.headers, bytes: Buffer.from(await res.arrayBuffer()) };
};
const short = (path: string): string => (path.split('?')[0] ?? path).replace('/workforce/payroll', '').replace(/[0-9a-f-]{36}/g, ':id');
const expectStatus = async (label: string, who: string, method: string, path: string, expected: number, body?: object): Promise<Reply> => {
  const reply = await call(who, method, path, body);
  check(`${label}: ${who.split('@')[0]} ${method} ${short(path)} -> ${expected}`, reply.status === expected, `got ${reply.status} ${JSON.stringify(reply.body).slice(0, 240)}`);
  return reply;
};
const expectCode = async (label: string, who: string, method: string, path: string, expected: number, code: string, body?: object): Promise<Reply> => {
  const reply = await call(who, method, path, body);
  check(`${label}: ${who.split('@')[0]} ${method} ${short(path)} -> ${expected} ${code}`, reply.status === expected && reply.body.error?.code === code, `got ${reply.status} ${JSON.stringify(reply.body).slice(0, 240)}`);
  return reply;
};

const HR = 'hr@wendo.test';
const ADMIN = 'admin@wendo.test';
const BM = 'bm.town@wendo.test';
const HIGHWAY = 'bm.highway@wendo.test';
const STORE = 'store.manager@wendo.test';
const DIRECTOR = 'director@wendo.test';
const ACCOUNTANT = 'accountant@wendo.test';
const HEAD = 'kitchen.head.town@wendo.test';
const WAITER = 'proof.tsh.waiter@wendo.test';
const NO_ACCESS = [BM, HIGHWAY, STORE, HEAD, WAITER];
const P = '/workforce/payroll';
const M = `${P}/months/2026-09`;
let keyCount = 0;
const nextKey = (label: string): string => `proof2-${label}-${Date.now()}-${(keyCount += 1)}`;
const save = (name: string, bytes: Buffer): void => {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${name}`, bytes);
};

/** The hand calculation, written out here on purpose and independent of the engine (the same as part 1's proof). */
const half = (n: bigint, d: bigint): bigint => (n * 2n + d) / (d * 2n);
const money = (c: bigint): string => `${c / 100n}.${(c % 100n).toString().padStart(2, '0')}`;
function byHand(monthly: bigint, otMinutes: number, absentDays: number, allowance = 0n) {
  const overtime = half(BigInt(otMinutes) * monthly * 12n * 15n, 60n * 48n * 52n * 10n);
  const absence = half(monthly * BigInt(absentDays), 30n);
  const gross = monthly + overtime - absence + allowance; // a taxable allowance (500.00) is part of gross
  const alpha = half(gross * 6n, 100n);
  const taxable = gross - alpha;
  const band = (from: bigint, to: bigint | null) => (taxable <= from ? 0n : (to === null || taxable < to ? taxable : to) - from);
  const tax = half(band(0n, 2400000n) * 10n + band(2400000n, 3233300n) * 25n + band(3233300n, null) * 30n, 100n);
  const paye = tax > 200000n ? tax - 200000n : 0n;
  return { overtime, absence, gross, alpha, taxable, paye, net: gross - alpha - paye };
}

async function main(): Promise<void> {
  const town = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { siteId: true, site: { select: { companyId: true } } } });
  const townId = town.siteId as string;
  const companyId = town.site!.companyId;
  const monthId = (await prisma.payrollMonth.findFirstOrThrow({ where: { companyId, monthKey: '2026-09' } })).id;
  const waiter = await prisma.employee.findFirstOrThrow({ where: { employeeNumber: 'ZZT-1' } });
  const lena = await prisma.employee.findFirstOrThrow({ where: { employeeNumber: 'ZZT-2' } });
  const period = await prisma.timesheetPeriod.findFirstOrThrow({ where: { siteId: townId, startDate: new Date('2026-09-01T00:00:00Z') } });
  const absent = (id: string): number => (period.approvedSnapshot as { people: { employeeId: string; absentDays: number }[] }).people.find((p) => p.employeeId === id)?.absentDays ?? 0;
  const otMinutes = async (id: string): Promise<number> => (await prisma.overtimeItem.aggregate({ where: { employeeId: id }, _sum: { authorisedMinutes: true } }))._sum.authorisedMinutes ?? 0;
  const hand = { waiter: byHand(3000000n, await otMinutes(waiter.id), absent(waiter.id)), lena: byHand(4500000n, await otMinutes(lena.id), absent(lena.id)), waiterFixed: byHand(3000000n, await otMinutes(waiter.id), absent(waiter.id), 50000n) };
  const handNet = hand.waiter.net + hand.lena.net;
  const handNetFixed = hand.waiterFixed.net + hand.lena.net;
  out(`hand figures: waiter net ${money(hand.waiter.net)} (corrected, with a 500.00 taxable airtime line: ${money(hand.waiterFixed.net)}); Lena net ${money(hand.lena.net)}; month ${money(handNet)} then ${money(handNetFixed)}`);

  await new Promise((resolve) => setTimeout(resolve, 62_000)); // the login door allows 10 a minute and the earlier proofs just used it
  for (const email of [HR, ADMIN, BM, HIGHWAY, STORE, DIRECTOR, ACCOUNTANT, HEAD, WAITER]) await login(email);
  const view = async (who = HR): Promise<Body> => (await call(who, 'GET', M)).body.data as Body;
  const start = await view();
  check('September is approved and waiting to publish (PAY-2026-09)', start['state'] === 'TO_PUBLISH' && start['documentNumber'] === 'PAY-2026-09', JSON.stringify([start['state'], start['documentNumber']]));
  const sv = (): Promise<number> => view().then((v) => v['stateVersion'] as number);

  out('\n== 1. publish: only HR, with the PIN and the version');
  const slipsBefore = (await call(HR, 'GET', `${M}/payslips`)).body.data as Body;
  check('before publishing the payslips are Ready and have no PS number', slipsBefore['rows'].every((r: Body) => r['status'] === 'READY' && r['documentNumber'] === null));
  await expectCode('the pay-out card does not exist yet', HR, 'GET', `${M}/payout`, 409, 'TAB_NOT_AVAILABLE');
  await expectCode('the bank file is not available yet', ACCOUNTANT, 'POST', `${M}/bank-file`, 409, 'BANK_FILE_NOT_AVAILABLE', { idempotencyKey: nextKey('bank') });
  await expectCode('all payslips wait for publishing', HR, 'POST', `${M}/exports`, 409, 'PAYSLIPS_NOT_PUBLISHED', { kind: 'PAYSLIPS', format: 'zip', idempotencyKey: nextKey('export') });
  const pub = (over: Body = {}) => ({ pin: PIN, idempotencyKey: nextKey('publish'), stateVersion: start['stateVersion'], ...over });
  for (const who of [ACCOUNTANT, DIRECTOR, ADMIN, ...NO_ACCESS]) await expectStatus('publish', who, 'POST', `${M}/publish`, 403, pub());
  await expectCode('a wrong PIN', HR, 'POST', `${M}/publish`, 403, 'PIN_INVALID', pub({ pin: '0000' }));
  await expectCode('a stale version', HR, 'POST', `${M}/publish`, 409, 'CHANGED_UNDERNEATH', pub({ stateVersion: start['stateVersion'] + 5 }));
  await expectStatus('a bad PIN shape', HR, 'POST', `${M}/publish`, 400, pub({ pin: '12' }));
  check('nothing was published by any of that', (await view())['state'] === 'TO_PUBLISH');
  const key = nextKey('publish');
  const published = await expectStatus('HR publishes September with their PIN', HR, 'POST', `${M}/publish`, 200, pub({ idempotencyKey: key }));
  check('it is Published and two payslips were issued', published.body.data?.['state'] === 'PUBLISHED' && published.body.data['published'] === 2, JSON.stringify(published.body.data));
  check('a double click answers the first result', (await call(HR, 'POST', `${M}/publish`, pub({ idempotencyKey: key }))).body.data?.['repeat'] === true);
  await expectCode('another key is too late', HR, 'POST', `${M}/publish`, 409, 'ALREADY_PUBLISHED', pub());
  const slips = (await call(HR, 'GET', `${M}/payslips`)).body.data as Body;
  const numbers = slips['rows'].map((r: Body) => r['documentNumber']);
  check('each payslip has its own PS-nnnn and shows Published', numbers.every((n: string) => /^PS-\d{4}$/.test(n)) && new Set(numbers).size === 2 && slips['rows'].every((r: Body) => r['status'] === 'PUBLISHED'), JSON.stringify(numbers));
  await expectCode('the switch for Nyeri Town cannot go off while September is unpaid', ADMIN, 'PUT', '/workforce/attendance/switch', 409, 'SITE_IN_UNPAID_PAYROLL', { siteId: townId, enabled: false });

  out('\n== 2. who sees and does what once published');
  for (const [who, expected] of [[HR, 200], [ACCOUNTANT, 200], [DIRECTOR, 200], [ADMIN, 200], ...NO_ACCESS.map((u) => [u, 403] as const)] as const) {
    await expectStatus('read the pay-out card', who, 'GET', `${M}/payout`, expected);
    await expectStatus('read the payslips', who, 'GET', `${M}/payslips`, expected);
  }
  const caps = async (who: string) => (await view(who))['capabilities'] as Body;
  const hrCaps = await caps(HR);
  const accCaps = await caps(ACCOUNTANT);
  const dirCaps = await caps(DIRECTOR);
  const adminCaps = await caps(ADMIN);
  check('HR may correct and export, not pay; the Accountant may pay, correct and export; the Director only exports', hrCaps['canCorrect'] === true && hrCaps['canPay'] === false && hrCaps['canExport'] === true && accCaps['canPay'] === true && accCaps['canCorrect'] === true && dirCaps['canExport'] === true && dirCaps['canCorrect'] === false && dirCaps['canPay'] === false && dirCaps['canPublish'] === false, JSON.stringify([hrCaps, accCaps, dirCaps]));
  check('the System Admin has no write button and no export', Object.values(adminCaps).every((v) => v === false), JSON.stringify(adminCaps));
  const pay0 = (await call(HR, 'GET', `${M}/payout`)).body.data as Body;
  check('the pay-out card: two people by bank, the right amount, no file yet, Mark as paid blocked', pay0['methods'][0].people === 2 && pay0['methods'][0].amount === money(handNet) && pay0['methods'][0].file.state === 'NONE' && pay0['canMarkPaid'] === false && pay0['blockedBy'] === 'NO_FILE', JSON.stringify(pay0));
  check('no account number is in any read', !JSON.stringify(pay0).includes('99100') && !JSON.stringify(slips).includes('99100'));

  out('\n== 3. the bank file: the Accountant only, bank only, never casual');
  for (const who of [HR, DIRECTOR, ADMIN, ...NO_ACCESS]) await expectStatus('download the bank file', who, 'POST', `${M}/bank-file`, 403, { idempotencyKey: nextKey('bank') });
  await expectCode('Mark as paid needs a download first', ACCOUNTANT, 'POST', `${M}/mark-paid`, 409, 'BANK_FILE_REQUIRED', { pin: PIN, idempotencyKey: nextKey('pay'), stateVersion: await sv() });
  const bankKey = nextKey('bank');
  const file1 = await raw(ACCOUNTANT, 'POST', `${M}/bank-file`, { idempotencyKey: bankKey });
  const text1 = file1.bytes.toString('utf8');
  const rows1 = text1.split('\r\n').filter(Boolean);
  save('bank-2026-09.csv', file1.bytes);
  check('the file is a CSV named bank-2026-09.csv, never cached, with its hash', file1.status === 200 && file1.headers.get('content-type')?.startsWith('text/csv') === true && file1.headers.get('content-disposition') === 'attachment; filename="bank-2026-09.csv"' && file1.headers.get('cache-control') === 'no-store' && file1.headers.get('x-bank-file-version') === '1');
  check('header row, then the waiter and Lena only, with the hand-calculated nets', rows1.length === 3 && rows1[0] === 'Reference,Account name,Bank name,Branch,Account number,Amount,Currency,Narration,Employee number' && rows1.some((r) => r.includes(`,${money(hand.waiter.net)},KES,Wendo salary Sep 2026,`)) && rows1.some((r) => r.includes(`,${money(hand.lena.net)},KES,`)), text1);
  const hash1 = file1.headers.get('x-bank-file-hash') as string;
  check('the same key again is the same file and writes no second record', (await raw(ACCOUNTANT, 'POST', `${M}/bank-file`, { idempotencyKey: bankKey })).headers.get('x-bank-file-hash') === hash1 && (await prisma.payrollBankFile.count({ where: { month: { monthKey: '2026-09' } } })) === 1);
  const pay1 = (await call(HR, 'GET', `${M}/payout`)).body.data as Body;
  check('HR sees the file as downloaded and Mark as paid ready', pay1['methods'][0].file.state === 'DOWNLOADED' && pay1['methods'][0].file.hash === hash1 && pay1['canMarkPaid'] === true);

  out('\n== 4. a correction: version 2, the file voided, a new download');
  const slipRow = slips['rows'].find((r: Body) => r['employeeId'] === waiter.id) as Body;
  const change = { kind: 'EXTRA_LINE', changes: { add: [{ type: 'ALLOWANCE', label: 'Airtime', amount: '500.00', taxable: true }], removeIds: [] } };
  for (const who of [DIRECTOR, ADMIN, ...NO_ACCESS]) await expectStatus('open a correction', who, 'GET', `${M}/payslips/${slipRow['payslipId']}/correction-inputs?version=1`, 403);
  const inputs = await expectStatus('HR opens the correction', HR, 'GET', `${M}/payslips/${slipRow['payslipId']}/correction-inputs?version=1`, 200);
  const shown = (inputs.body.data ?? {}) as Body;
  check('it shows the values now (no extra line yet) and the downloaded bank file', Array.isArray(shown['current']?.extraLines) && shown['current'].extraLines.length === 0 && shown['bankFile'] !== null, JSON.stringify(shown));
  const preview = await expectStatus('the live preview', HR, 'POST', `${M}/payslips/${slipRow['payslipId']}/correction-preview`, 200, { change, expectedVersion: 1 });
  check('NOW and CORRECTED equal the hand calculation, and it says the file would be voided', preview.body.data?.['netNow'] === money(hand.waiter.net) && preview.body.data['netCorrected'] === money(hand.waiterFixed.net) && preview.body.data['voidsBankFile'] === true, JSON.stringify(preview.body.data));
  check('a preview saves nothing', (await prisma.payrollPayslip.count({ where: { employeeId: waiter.id, monthId, version: { gt: 1 } } })) === 0);
  await expectCode('a change that changes nothing', HR, 'POST', `${M}/payslips/${slipRow['payslipId']}/correction-preview`, 422, 'NO_CHANGE', { change: { kind: 'UNPAID_ABSENCE', changes: { absentDays: absent(waiter.id) } }, expectedVersion: 1 });
  await expectCode('late days can only go down', HR, 'POST', `${M}/payslips/${slipRow['payslipId']}/correction-preview`, 422, 'CORRECTION_NOT_ALLOWED', { change: { kind: 'LATE_DAYS', changes: { lateDaysCounted: 20 } }, expectedVersion: 1 });
  const fix = (over: Body = {}) => ({ change, reason: 'The airtime allowance was agreed but left out', pin: PIN, expectedVersion: 1, idempotencyKey: nextKey('correct'), ...over });
  for (const who of [DIRECTOR, ADMIN, ...NO_ACCESS]) await expectStatus('correct a payslip', who, 'POST', `${M}/payslips/${slipRow['payslipId']}/correct`, 403, fix());
  await expectStatus('a reason is needed', HR, 'POST', `${M}/payslips/${slipRow['payslipId']}/correct`, 400, fix({ reason: 'no' }));
  await expectStatus('a reason may not carry an amount', HR, 'POST', `${M}/payslips/${slipRow['payslipId']}/correct`, 400, fix({ reason: 'Airtime of 12500 was agreed' }));
  await expectCode('a wrong PIN', HR, 'POST', `${M}/payslips/${slipRow['payslipId']}/correct`, 403, 'PIN_INVALID', fix({ pin: '0000' }));
  await expectCode('a stale version', HR, 'POST', `${M}/payslips/${slipRow['payslipId']}/correct`, 409, 'PAYSLIP_CHANGED', fix({ expectedVersion: 2 }));
  await expectCode('a payslip of another month or another company is a 404', HR, 'POST', `${M}/payslips/00000000-0000-4000-8000-000000000000/correct`, 404, 'NO_PAYSLIP', fix());
  const fixKey = nextKey('correct');
  const fixed = await expectStatus('HR adds the waiter\'s airtime line with a reason and a PIN', HR, 'POST', `${M}/payslips/${slipRow['payslipId']}/correct`, 200, fix({ idempotencyKey: fixKey }));
  check('it is version 2, from the hand figure to the hand figure, and the file was voided', fixed.body.data?.['version'] === 2 && fixed.body.data['netBefore'] === money(hand.waiter.net) && fixed.body.data['netAfter'] === money(hand.waiterFixed.net) && fixed.body.data['bankFileVoided'] === true, JSON.stringify(fixed.body.data));
  check('a double click answers the first result', (await call(HR, 'POST', `${M}/payslips/${slipRow['payslipId']}/correct`, fix({ idempotencyKey: fixKey }))).body.data?.['repeat'] === true);
  const old = (await call(HR, 'GET', `${M}/payslips/${slipRow['payslipId']}`)).body.data as Body;
  check('version 1 stays readable and says it was replaced by version 2', old['version'] === 1 && old['replacedBy'] === 2 && old['versions'].length === 2 && old['totals'].net === money(hand.waiter.net), JSON.stringify([old['version'], old['replacedBy']]));
  const slips2 = (await call(HR, 'GET', `${M}/payslips`)).body.data as Body;
  check('the list shows the current version once, marked corrected', slips2['rows'].length === 2 && slips2['counts'].corrected === 1 && slips2['rows'].find((r: Body) => r['employeeId'] === waiter.id).version === 2);
  check('the Totals tab and the month follow the correction (the hand figure)', ((await call(HR, 'GET', `${M}/totals`)).body.data as Body)['total'].net === money(handNetFixed) && (await view())['kpis'].net === money(handNetFixed));
  const pay2 = (await call(HR, 'GET', `${M}/payout`)).body.data as Body;
  check('HR sees the voided file and why', pay2['methods'][0].file.state === 'VOIDED' && String(pay2['methods'][0].file.voidReason).includes('payslip was corrected') && pay2['canMarkPaid'] === false, JSON.stringify(pay2['methods'][0].file));
  await expectCode('Mark as paid refuses the old file', ACCOUNTANT, 'POST', `${M}/mark-paid`, 409, 'BANK_FILE_REQUIRED', { pin: PIN, idempotencyKey: nextKey('pay'), stateVersion: await sv(), bankFileHash: hash1 });
  const file2 = await raw(ACCOUNTANT, 'POST', `${M}/bank-file`, { idempotencyKey: nextKey('bank') });
  const hash2 = file2.headers.get('x-bank-file-hash') as string;
  save('bank-2026-09-v2.csv', file2.bytes);
  check('the new download is bank-2026-09-v2.csv with the corrected amount', file2.headers.get('content-disposition') === 'attachment; filename="bank-2026-09-v2.csv"' && file2.bytes.toString('utf8').includes(money(hand.waiterFixed.net)) && !file2.bytes.toString('utf8').includes(`,${money(hand.waiter.net)},`) && hash2 !== hash1);

  out('\n== 5. Mark as paid and the lock');
  const pay = (over: Body = {}) => ({ pin: PIN, idempotencyKey: nextKey('pay'), stateVersion: 0, bankFileHash: hash2, ...over });
  const version = await sv();
  for (const who of [HR, DIRECTOR, ADMIN, ...NO_ACCESS]) await expectStatus('mark paid', who, 'POST', `${M}/mark-paid`, 403, pay({ stateVersion: version }));
  await expectCode('a wrong PIN', ACCOUNTANT, 'POST', `${M}/mark-paid`, 403, 'PIN_INVALID', pay({ stateVersion: version, pin: '0000' }));
  await expectCode('the file the dialog showed is not the current one', ACCOUNTANT, 'POST', `${M}/mark-paid`, 409, 'BANK_FILE_CHANGED', pay({ stateVersion: version, bankFileHash: hash1 }));
  await expectCode('a stale version', ACCOUNTANT, 'POST', `${M}/mark-paid`, 409, 'CHANGED_UNDERNEATH', pay({ stateVersion: version + 4 }));
  check('nothing was locked by any of that', (await view())['state'] === 'PUBLISHED');
  const payKey = nextKey('pay');
  const paid = await expectStatus('the Accountant marks September paid with their PIN', ACCOUNTANT, 'POST', `${M}/mark-paid`, 200, pay({ stateVersion: version, idempotencyKey: payKey }));
  check('the month is Paid', paid.body.data?.['state'] === 'PAID', JSON.stringify(paid.body.data));
  check('a double click answers the first result', (await call(ACCOUNTANT, 'POST', `${M}/mark-paid`, pay({ stateVersion: version, idempotencyKey: payKey }))).body.data?.['repeat'] === true);
  await expectCode('another key is too late', ACCOUNTANT, 'POST', `${M}/mark-paid`, 409, 'ALREADY_PAID', pay({ stateVersion: version }));
  const locked = await view();
  check('the month says Paid and Locked, with every action button gone but the export', locked['state'] === 'PAID' && locked['lockedAt'] !== null && !locked['capabilities'].canReview && !locked['capabilities'].canPublish && !locked['capabilities'].canPay && !locked['capabilities'].canCorrect && locked['capabilities'].canExport === true, JSON.stringify(locked['capabilities']));
  check('the stage line is all done', locked['stages'].every((s: Body) => s['status'] === 'DONE'), JSON.stringify(locked['stages'].map((s: Body) => s['status'])));

  const lv = locked['stateVersion'] as number;
  const k = () => nextKey('locked');
  const writes: [string, string, string, string, Body][] = [
    ['recalculate', HR, 'POST', `${M}/recalculate`, { idempotencyKey: k(), stateVersion: lv }],
    ['send', HR, 'POST', `${M}/send-to-accountant`, { idempotencyKey: k(), stateVersion: lv }],
    ['send back', ACCOUNTANT, 'POST', `${M}/send-back`, { reason: 'Too late to look again', idempotencyKey: k(), stateVersion: lv }],
    ['approve', ACCOUNTANT, 'POST', `${M}/approve`, { pin: PIN, idempotencyKey: k(), stateVersion: lv, expectedTotals: { gross: '1.00', net: '1.00', taxStatutory: '0.00', other: '0.00', headcount: 1 } }],
    ['publish', HR, 'POST', `${M}/publish`, { pin: PIN, idempotencyKey: k(), stateVersion: lv }],
    ['correct', HR, 'POST', `${M}/payslips/${slipRow['payslipId']}/correct`, fix({ expectedVersion: 2, idempotencyKey: k() })],
    ['correct as the Accountant', ACCOUNTANT, 'POST', `${M}/payslips/${slipRow['payslipId']}/correct`, fix({ expectedVersion: 2, idempotencyKey: k() })],
    ['add a line', HR, 'POST', `${M}/adjustments`, { employeeId: waiter.id, type: 'ALLOWANCE', label: 'Airtime', amount: '500', taxable: true, reason: 'Trying after the month is paid', pin: PIN, idempotencyKey: k(), stateVersion: lv }],
    ['tick a line', HR, 'POST', `${M}/review/check-kind`, { kind: 'NEW_JOINER', stateVersion: lv }],
    ['remind a site', HR, 'POST', `${M}/sites/${townId}/remind`, { idempotencyKey: k() }],
  ];
  for (const [label, who, method, path, body] of writes) await expectCode(`after Paid: ${label}`, who, method, path, 409, 'MONTH_LOCKED', body);
  const row = await prisma.payrollMonth.findFirstOrThrow({ where: { companyId, monthKey: '2026-09' } });
  const direct: [string, () => Promise<unknown>][] = [
    ['the month row', () => prisma.payrollMonth.update({ where: { id: row.id }, data: { state: 'PUBLISHED', lockedAt: null } })],
    ['a payslip line', () => prisma.$executeRaw`UPDATE payroll_payslip_lines SET amount = 1 WHERE payslip_id IN (SELECT id FROM payroll_payslips WHERE month_id = ${row.id})`],
    ['an adjustment', () => prisma.payrollAdjustment.create({ data: { monthId: row.id, employeeId: waiter.id, siteId: townId, kind: 'ALLOWANCE', label: 'x', amount: 1, reason: 'x', idempotencyKey: 'x', createdById: waiter.id } })],
    ['the bank file records', () => prisma.payrollBankFile.updateMany({ where: { monthId: row.id }, data: { state: 'DOWNLOADED', voidedAt: null, voidReason: null } })],
    ['the snapshot', () => prisma.payrollSnapshot.create({ data: { monthId: row.id, revision: 99, hash: 'x', data: {} } })],
  ];
  for (const [label, write] of direct) check(`the database refuses a direct write to ${label}`, await write().then(() => false, (e: Error) => /MONTH_LOCKED|insert-only/.test(e.message)));
  const rowAfter = await prisma.payrollMonth.findFirstOrThrow({ where: { id: row.id } });
  check('the month row did not move', rowAfter.state === 'PAID' && rowAfter.stateVersion === lv && rowAfter.lockedAt !== null);
  for (const who of [HR, ACCOUNTANT, DIRECTOR, ADMIN]) await expectStatus('Paid months stay readable', who, 'GET', `${M}/payslips`, 200);
  const again = await raw(ACCOUNTANT, 'POST', `${M}/bank-file`, { idempotencyKey: nextKey('bank') });
  check('the Accountant can still download the file again; it is the same file and records nothing new', again.status === 200 && again.headers.get('x-bank-file-hash') === hash2 && (await prisma.payrollBankFile.count({ where: { monthId: row.id } })) === 2);

  out('\n== 6. every document downloads and opens');
  const doc = async (who: string, kind: string, format: string, name: string) => {
    const res = await raw(who, 'POST', `${M}/exports`, { kind, format, idempotencyKey: nextKey('export') });
    save(name, res.bytes);
    check(`${who.split('@')[0]} downloads ${name}`, res.status === 200 && res.headers.get('content-disposition') === `attachment; filename="${name}"` && res.headers.get('x-document-number') === 'PAY-2026-09' && res.headers.get('x-revision') === '2' && res.headers.get('cache-control') === 'no-store', `${res.status} ${res.headers.get('content-disposition')} ${res.headers.get('x-revision')}`);
    return res.bytes;
  };
  for (const who of [ACCOUNTANT, HR, DIRECTOR]) {
    const pdf = await doc(who, 'REGISTER', 'pdf', 'Payroll-register-2026-09.pdf');
    check('the register opens as a PDF', pdf.subarray(0, 5).toString() === '%PDF-' && pdf.length > 3000);
  }
  const summary = await doc(ACCOUNTANT, 'SUMMARY', 'pdf', 'Payroll-summary-2026-09.pdf');
  check('the summary opens as one page', summary.subarray(0, 5).toString() === '%PDF-' && (summary.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length === 1);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load((await doc(ACCOUNTANT, 'REGISTER', 'xlsx', 'Payroll-2026-09.xlsx')) as unknown as ArrayBuffer);
  check('the Accountant\'s workbook has five sheets, the banner names the revision', book.worksheets.map((w) => w.name).join() === 'Summary,Register,Statutory,Casual pay,Bank file' && String(book.getWorksheet('Register')?.getCell('A1').value).includes('Revision 2'), book.worksheets.map((w) => w.name).join());
  const register = book.getWorksheet('Register')!;
  const heads = (register.getRow(2).values as unknown[]).slice(1).join();
  check('the register has a column per tax table in the Accountant\'s order', heads === 'Person,Department,Site,Basic,Overtime,Gross,Alpha,Gamma,Other deductions,Net pay', heads);
  const nets = [3, 4].map((r) => Math.round(Number(register.getRow(r).getCell(10).value) * 100));
  check('the Net pay column adds to the hand figure and the total row is a live SUM', BigInt(nets[0]! + nets[1]!) === handNetFixed && String((register.getRow(5).getCell(10).value as { formula?: string }).formula) === 'SUM(J3:J4)', JSON.stringify(nets));
  const hrBook = new ExcelJS.Workbook();
  await hrBook.xlsx.load((await doc(HR, 'REGISTER', 'xlsx', 'Payroll-2026-09.xlsx')) as unknown as ArrayBuffer);
  check('HR\'s workbook has no bank sheet', !hrBook.worksheets.some((w) => w.name === 'Bank file'));
  const statutory = new ExcelJS.Workbook();
  await statutory.xlsx.load((await doc(DIRECTOR, 'STATUTORY', 'xlsx', 'Statutory-2026-09.xlsx')) as unknown as ArrayBuffer);
  check('the statutory schedules have an index and a sheet for each table, with filing numbers', statutory.worksheets.map((w) => w.name).join() === 'Index,Alpha,Gamma' && Boolean(statutory.getWorksheet('Alpha')?.getCell('C3').value));
  const zip = await doc(HR, 'PAYSLIPS', 'zip', 'Payslips-2026-09.zip');
  check('all payslips: a zip with one PDF for each of the two people', zip.readUInt32LE(zip.length - 22) === 0x06054b50 && zip.readUInt16LE(zip.length - 22 + 10) === 2);
  for (const who of [ADMIN, ...NO_ACCESS]) await expectStatus('export', who, 'POST', `${M}/exports`, 403, { kind: 'SUMMARY', format: 'pdf', idempotencyKey: nextKey('export') });
  await expectStatus('a kind with a format it does not have', ACCOUNTANT, 'POST', `${M}/exports`, 400, { kind: 'SUMMARY', format: 'xlsx', idempotencyKey: nextKey('export') });
  const exportKey = nextKey('export');
  const before = await prisma.auditEntry.count({ where: { companyId, action: 'payroll.exported' } });
  await raw(DIRECTOR, 'POST', `${M}/exports`, { kind: 'SUMMARY', format: 'pdf', idempotencyKey: exportKey });
  await raw(DIRECTOR, 'POST', `${M}/exports`, { kind: 'SUMMARY', format: 'pdf', idempotencyKey: exportKey });
  check('the same export key twice writes one audit entry', (await prisma.auditEntry.count({ where: { companyId, action: 'payroll.exported' } })) === before + 1);

  out('\n== 7. the clock can be switched off once the month is paid, and the integrity checks');
  await expectStatus('System Admin switches Nyeri Town off', ADMIN, 'PUT', '/workforce/attendance/switch', 200, { siteId: townId, enabled: false });
  const entries = JSON.stringify(await prisma.auditEntry.findMany({ where: { companyId, subjectId: row.id }, select: { before: true, after: true, reason: true } }));
  check('the audit entries hold no PIN and no account number', !entries.includes(PIN) && !entries.includes('99100') && !entries.includes('99200'));
  const actions = new Set((await prisma.auditEntry.findMany({ where: { companyId, subjectId: row.id }, select: { action: true } })).map((e) => e.action));
  check('publish, correction, void, downloads, paid and exports are all in the audit log', ['payroll.published', 'payroll.payslip_corrected', 'payroll.bank_file_voided', 'payroll.bank_file_downloaded', 'payroll.marked_paid', 'payroll.exported'].every((a) => actions.has(a)), [...actions].join());
  const log = await prisma.auditEntry.findMany({ where: { companyId }, orderBy: { seq: 'asc' } });
  const chain = verifyAuditChain(log.map((r) => ({ ...r, category: r.category as AuditCategoryCode, channel: r.channel as AuditEntryRecord['channel'], before: r.before as AuditEntryRecord['before'], after: r.after as AuditEntryRecord['after'] })));
  check('the audit chain verifies', chain.ok === true, JSON.stringify(chain, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
  out(`\n${passed} passed, ${failed} failed. Data left in place: run payroll-proof.ts down, then timesheets-proof.ts down.`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
