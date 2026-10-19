/**
 * Workforce Segment 2A: the Payroll proof run over HTTP with the real seeded logins, against the lane database and the lane API.
 * It builds on the data the Segment 1A proof leaves behind (Nyeri Town, September 2026 approved by its manager, a waiter with a login,
 * Lena without one):  run `timesheets-proof.ts up` first, and `payroll-proof.ts down` BEFORE `timesheets-proof.ts down`.
 *   up    gives those people pay (and one person none), saves the tax tables and overtime rates unconfirmed, switches Nyeri Town
 *         on, then walks the month: waiting for the Accountant's confirmation, the Accountant confirms, the system calculates, the
 *         figures match a hand calculation written independently here, who sees and does what for every role, the review (a person
 *         without a pay profile blocks, HR leaves them out, a line is added with a PIN), send, send back, approve (refusals first),
 *         the old payslip run refused for the site and month but untouched for another site, the estimate, the switch that cannot
 *         be turned off while the month is unpaid, the audit chain. It leaves the data for inspection.
 *   down  removes everything `up` made (the audit entries stay: the log is append-only) and switches Nyeri Town off.
 * Usage: API=http://localhost:4101 pnpm exec tsx src/scripts/payroll-proof.ts up|down
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { refreshPayrollEstimates, sweepPayroll, toDateColumn, verifyAuditChain, type AuditCategoryCode, type AuditEntryRecord, type NairobiDate } from '../modules/workforce';
import { comparePin, hashPin } from '../utils/password';

const API = `${process.env['API'] ?? 'http://localhost:4101'}/api/v1`;
const TAG = 'ZZ Proof Pay';
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
const call = async (who: string, method: string, path: string, body?: object): Promise<Reply> => {
  const res = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.get(who)}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Reply['body'] };
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
const P = '/workforce/payroll';
const M = `${P}/months/2026-09`;
let keyCount = 0;
const nextKey = (label: string): string => `proof-${label}-${Date.now()}-${(keyCount += 1)}`;

/** The hand calculation, written out here on purpose and independent of the engine: whole cents, half up, one rounding per line. */
const half = (n: bigint, d: bigint): bigint => (n * 2n + d) / (d * 2n);
const money = (c: bigint): string => `${c / 100n}.${(c % 100n).toString().padStart(2, '0')}`;
function byHand(monthly: bigint, otMinutes: number, absentDays: number) {
  const overtime = half(BigInt(otMinutes) * monthly * 12n * 15n, 60n * 48n * 52n * 10n); // minutes ÷ 60 × monthly × 12 ÷ (48 × 52) × 1.5
  const absence = half(monthly * BigInt(absentDays), 30n);
  const gross = monthly + overtime - absence;
  const alpha = half(gross * 6n, 100n); // 6% of gross, allowable
  const taxable = gross - alpha;
  const band = (from: bigint, to: bigint | null) => (taxable <= from ? 0n : (to === null || taxable < to ? taxable : to) - from);
  const tax = half(band(0n, 2400000n) * 10n + band(2400000n, 3233300n) * 25n + band(3233300n, null) * 30n, 100n);
  const paye = tax > 200000n ? tax - 200000n : 0n; // personal relief 2,000
  return { overtime, absence, gross, alpha, taxable, paye, net: gross - alpha - paye };
}

async function down(): Promise<void> {
  const people = await prisma.employee.findMany({ where: { employeeNumber: { startsWith: 'ZZT-' } }, select: { id: true } });
  const ids = people.map((p) => p.id);
  const town = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { siteId: true, site: { select: { companyId: true } } } });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('wendo.allow_payroll_edit', 'on', true)`; // the dev teardown door for the insert-only tables
    await tx.payrollMonth.deleteMany({ where: { companyId: town.site!.companyId } });
  });
  await prisma.payrollReminder.deleteMany({});
  await prisma.payrollRequestKey.deleteMany({});
  await prisma.payrollEstimate.deleteMany({});
  await prisma.payChange.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.payProfile.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.employmentSpell.deleteMany({ where: { employeeId: { in: ids } } });
  await prisma.employee.deleteMany({ where: { employeeNumber: 'ZZT-3' } });
  const versions = await prisma.ruleVersion.findMany({ where: { reason: { startsWith: TAG } }, select: { id: true } });
  await prisma.ruleConfirmation.deleteMany({ where: { ruleVersionId: { in: versions.map((v) => v.id) } } });
  await prisma.ruleVersion.deleteMany({ where: { id: { in: versions.map((v) => v.id) } } });
  await prisma.attendanceSiteSwitch.deleteMany({});
  for (const email of [HR, ACCOUNTANT, DIRECTOR]) {
    const u = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, pinHash: true } });
    if (u.pinHash && (await comparePin(PIN, u.pinHash))) await prisma.user.update({ where: { id: u.id }, data: { pinHash: null } }); // only the PIN this proof set
  }
  out('removed the payroll proof data (months, runs, payslips, the pay of the proof people, the proof rule versions, the switch). Now run timesheets-proof down.');
}

async function up(): Promise<void> {
  const town = await prisma.user.findUniqueOrThrow({ where: { email: BM }, select: { siteId: true, site: { select: { companyId: true } } } });
  const townId = town.siteId as string;
  const companyId = town.site!.companyId;
  const waiter = await prisma.employee.findFirst({ where: { employeeNumber: 'ZZT-1' } });
  const lena = await prisma.employee.findFirst({ where: { employeeNumber: 'ZZT-2' } });
  if (!waiter || !lena) throw new Error('Run timesheets-proof.ts up first: it makes the people and the approved September month.');
  const accountantUser = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNTANT }, select: { id: true } });
  const hrUser = await prisma.user.findUniqueOrThrow({ where: { email: HR }, select: { id: true } });
  const legacy = async () => JSON.stringify([await prisma.payslip.count(), await prisma.shift.count(), await prisma.clockRecord.count()]);
  const legacyBefore = await legacy();

  const pinHash = await hashPin(PIN);
  for (const email of [HR, ACCOUNTANT, DIRECTOR]) await prisma.user.update({ where: { email }, data: { pinHash } });
  const since = toDateColumn('2026-09-01' as NairobiDate);
  const carol = await prisma.employee.create({ data: { companyId, siteId: townId, employeeNumber: 'ZZT-3', name: `${TAG} Carol (no pay profile)`, payType: 'MONTHLY_SALARY', startDate: since, status: 'ACTIVE', tracksTime: true } });
  const pay = async (employeeId: string, amount: string | null, label: string) => {
    await prisma.employmentSpell.create({ data: { employeeId, startsOn: since } });
    await prisma.employee.update({ where: { id: employeeId }, data: { kraPin: `A00${label}`, nssfNumber: label, shaNumber: label } });
    if (amount) {
      await prisma.payProfile.create({ data: { employeeId, amount, overtimeEligible: true, standardWeekHours: '48', standardDayHours: '8', payoutMethod: 'BANK', bankName: 'Proof Bank', accountName: label, accountNumber: `99${label}001` } });
      await prisma.payChange.create({ data: { employeeId, amount, effectiveFrom: since, reason: TAG, status: 'APPROVED', requestedById: hrUser.id, decidedById: accountantUser.id, decidedAt: new Date() } });
    }
  };
  await pay(waiter.id, '30000', '1');
  await pay(lena.id, '45000', '2');
  await pay(carol.id, null, '3');
  const tables = {
    tables: [
      { code: 'NSSF', name: 'Alpha', bands: [{ fromAmount: '0', toAmount: null, ratePercent: '6', flatAmount: null }], note: null, kind: 'RATE', base: 'GROSS', reducesTaxable: true, isIncomeTax: false, employerRatePercent: '6', reliefMonthly: null, floorAmount: null, ceilingAmount: null },
      { code: 'PAYE', name: 'Gamma', bands: [{ fromAmount: '0', toAmount: '24000', ratePercent: '10', flatAmount: null }, { fromAmount: '24000', toAmount: '32333', ratePercent: '25', flatAmount: null }, { fromAmount: '32333', toAmount: null, ratePercent: '30', flatAmount: null }], note: null, kind: 'BANDS', base: 'TAXABLE', reducesTaxable: false, isIncomeTax: true, employerRatePercent: null, reliefMonthly: '2000', floorAmount: null, ceilingAmount: null },
    ],
  };
  const next = async (group: 'STATUTORY' | 'OVERTIME') => ((await prisma.ruleVersion.aggregate({ where: { companyId, siteId: null, group }, _max: { version: true } }))._max.version ?? 0) + 1;
  const statutory = await prisma.ruleVersion.create({ data: { companyId, group: 'STATUTORY', version: await next('STATUTORY'), effectiveFrom: since, values: tables, reason: `${TAG} tables (saved by the Accountant, not yet confirmed)`, createdById: accountantUser.id, createdByRole: 'ACCOUNTANT' } });
  const overtime = await prisma.ruleVersion.create({ data: { companyId, group: 'OVERTIME', version: await next('OVERTIME'), effectiveFrom: since, values: { serviceTailMinutes: 15, weeklyCapMinutes: null, branchBudgetMinutesPerPeriod: null, approvalWindowHours: 48, multipliers: { ordinaryDay: '1.5', restDay: '2' } }, reason: `${TAG} overtime rates`, createdById: accountantUser.id, createdByRole: 'ACCOUNTANT' } });
  out('gave the waiter 30,000 and Lena 45,000 a month (Carol has no pay profile); saved the tax tables and overtime rates, not yet confirmed');

  await new Promise((resolve) => setTimeout(resolve, 62_000)); // the login door allows 10 a minute and the timesheets proof just used it
  for (const email of [HR, ADMIN, BM, HIGHWAY, STORE, DIRECTOR, ACCOUNTANT, HEAD, WAITER]) await login(email);
  await expectStatus('System Admin switches Nyeri Town on', ADMIN, 'PUT', '/workforce/attendance/switch', 200, { siteId: townId, enabled: true });
  await prisma.attendanceSiteSwitch.update({ where: { siteId: townId }, data: { enabledAt: new Date('2026-09-01T00:00:00Z') } });

  out('\n== 1. the month ended, the tables are not confirmed: the month waits and says why');
  const swept = await sweepPayroll();
  check('the sweep made the September row and calculated nothing', swept.created >= 1 && swept.calculated === 0, JSON.stringify(swept));
  const waiting = await expectStatus('HR opens September', HR, 'GET', M, 200);
  check('it is Waiting, with the banner for the tax tables and the Accountant named', waiting.body.data?.['state'] === 'WAITING' && waiting.body.data['banner']?.kind === 'TABLES' && String(waiting.body.data['banner']?.waitingFor).includes('Accountant'), JSON.stringify(waiting.body.data?.['banner']));
  check('the stage line has six stages and only Timesheets is current', waiting.body.data?.['stages']?.length === 6 && waiting.body.data['stages'][0].status === 'CURRENT' && waiting.body.data['tabs'].length === 1);
  for (const [who, status] of [[HR, 200], [ACCOUNTANT, 200], [DIRECTOR, 200], [ADMIN, 200], [BM, 403], [HIGHWAY, 403], [STORE, 403], [HEAD, 403], [WAITER, 403]] as const) await expectStatus('read the months list', who, 'GET', `${P}/months`, status);
  await expectCode('a month that does not exist', HR, 'GET', `${P}/months/2025-01`, 404, 'NO_PAYROLL_MONTH');
  await expectCode('the totals tab is not there yet', HR, 'GET', `${M}/totals`, 409, 'TAB_NOT_AVAILABLE');
  await expectCode('nobody can calculate by hand before the tables are confirmed', HR, 'POST', `${M}/recalculate`, 409, 'TABLES_NOT_CONFIRMED', { idempotencyKey: nextKey('calc'), stateVersion: waiting.body.data?.['stateVersion'] });

  out('\n== 2. the Accountant confirms the tables with a PIN; the system calculates');
  await expectStatus('HR cannot confirm tax tables', HR, 'POST', `/workforce/rules/versions/${statutory.id}/confirm`, 403, { scope: 'statutory', pin: PIN });
  await expectStatus('the Accountant confirms the tax tables', ACCOUNTANT, 'POST', `/workforce/rules/versions/${statutory.id}/confirm`, 200, { scope: 'statutory', pin: PIN });
  await expectStatus('the Accountant confirms the overtime rates', ACCOUNTANT, 'POST', `/workforce/rules/versions/${overtime.id}/confirm`, 200, { scope: 'overtime.multipliers', pin: PIN });
  const calc = await sweepPayroll();
  check('the sweep calculated September', calc.calculated >= 1, JSON.stringify(calc));
  const month = await expectStatus('HR opens September', HR, 'GET', M, 200);
  const md = month.body.data as Body;
  check('it is In review, calculated by the system, with stage 2 done and HR checking lines', md['state'] === 'IN_REVIEW' && md['stages'][1].status === 'DONE' && md['stages'][2].status === 'CURRENT' && md['tablesConfirmed']?.by !== null, JSON.stringify([md['state'], md['tablesConfirmed']]));
  check('the tabs open and the header actions follow the role (HR can review, not approve)', md['tabs'].includes('totals') && md['capabilities'].canReview === true && md['capabilities'].canApprove === false);
  check('only Nyeri Town is in the month; first month for the site', JSON.stringify(md['organizations'].map((s: Body) => s['name'])) === JSON.stringify(['Nyeri Town']) && md['firstMonthForSites'].length === 1, JSON.stringify(md['organizations']));
  for (const tab of ['rules-applied', 'tax', 'casual', 'totals', 'payslips', 'review']) {
    for (const [who, status] of [[HR, 200], [ACCOUNTANT, 200], [DIRECTOR, 200], [ADMIN, 200], [BM, 403], [WAITER, 403]] as const) await expectStatus(`the ${tab} tab`, who, 'GET', `${M}/${tab}`, status);
  }

  out('\n== 3. the figures against a hand calculation written independently');
  const list = (await call(HR, 'GET', `${M}/payslips?rows=100`)).body.data as Body;
  const slipOf = async (employeeId: string): Promise<Body> => {
    const row = list['rows'].find((r: Body) => r['employeeId'] === employeeId);
    return (await call(HR, 'GET', `${M}/payslips/${row?.payslipId}`)).body.data as Body;
  };
  let handGross = 0n;
  let handNet = 0n;
  let waiterGross = 0n;
  for (const [label, emp, monthly] of [['the waiter', waiter, 3000000n], ['Lena', lena, 4500000n]] as const) {
    const ot = await prisma.overtimeItem.aggregate({ where: { employeeId: emp.id }, _sum: { authorisedMinutes: true } });
    const absent = ((await prisma.timesheetPeriod.findFirstOrThrow({ where: { siteId: townId, startDate: since } })).approvedSnapshot as { people: { employeeId: string; absentDays: number }[] }).people.find((p) => p.employeeId === emp.id)?.absentDays ?? 0;
    const h = byHand(monthly, ot._sum.authorisedMinutes ?? 0, absent);
    const slip = await slipOf(emp.id);
    out(`   ${label}: ${money(monthly)} + overtime ${money(h.overtime)} (${ot._sum.authorisedMinutes ?? 0} min × 1.5) − absence ${money(h.absence)} = gross ${money(h.gross)}; Alpha 6% ${money(h.alpha)}; taxable ${money(h.taxable)}; PAYE ${money(h.paye)}; net ${money(h.net)}`);
    check(`${label}: gross, Alpha, PAYE and net equal the hand calculation`, slip['totals'].gross === money(h.gross) && slip['totals'].incomeTax === money(h.paye) && slip['totals'].net === money(h.net) && slip['totals'].taxablePay === money(h.taxable), JSON.stringify(slip['totals']));
    check(`${label}: every line shows its working`, slip['lines'].every((l: Body) => typeof l['workingText'] === 'string' && l['workingText'].length > 0));
    handGross += h.gross;
    handNet += h.net;
    if (emp.id === waiter.id) waiterGross = h.gross;
  }
  const totals = (await call(HR, 'GET', `${M}/totals`)).body.data as Body;
  check('the Totals tab: the month adds up to the two payslips (Carol has none yet), and the sites add up to the total', totals['total'].gross === money(handGross) && totals['total'].net === money(handNet) && totals['bySite'].length === 1, JSON.stringify(totals['total']));
  const tax = (await call(HR, 'GET', `${M}/tax`)).body.data as Body;
  check('Tax and deductions: one panel per table in the Accountant\'s order, confirmed by the Accountant, an example from a real line', tax['tables'].map((t: Body) => t['name']).join() === 'Alpha,Gamma' && tax['confirmedBy']?.role === 'ACCOUNTANT' && typeof tax['tables'][0].example?.text === 'string', JSON.stringify(tax['tables']?.[0]?.example));

  out('\n== 4. the review: a person with no pay profile blocks the month');
  const review = (await call(HR, 'GET', `${M}/review?rows=100`)).body.data as Body;
  const blocker = review['lines'].find((l: Body) => l['severity'] === 'BLOCK');
  const blockers = review['lines'].filter((l: Body) => l['severity'] === 'BLOCK');
  check('Carol and the seeded Nyeri Town staff with no pay profile are blocking lines', blockers.length >= 1 && blockers.every((l: Body) => l['kind'] === 'MISSING_PAY_PROFILE') && blockers.some((l: Body) => String(l['name']).includes('Carol')), JSON.stringify(blockers.map((l: Body) => [l['name'], l['kind']])));
  const sendBody = (v: number) => ({ idempotencyKey: nextKey('send'), stateVersion: v });
  await expectCode('send refused while a line blocks', HR, 'POST', `${M}/send-to-accountant`, 409, 'BLOCKING_LINES', sendBody(review['stateVersion']));
  for (const [who, status] of [[ACCOUNTANT, 403], [DIRECTOR, 403], [ADMIN, 403], [BM, 403]] as const) await expectStatus('leave a person out', who, 'POST', `${M}/review/${blockers[0]?.id}/leave-out`, status, { reason: 'No pay profile yet', stateVersion: review['stateVersion'], idempotencyKey: nextKey('out') });
  const tickable = review['lines'].find((l: Body) => l['severity'] === 'TICK');
  if (tickable) await expectStatus('HR ticks a line', HR, 'POST', `${M}/review/${tickable.id}/check`, 200, { checked: true, stateVersion: review['stateVersion'] });
  let version = review['stateVersion'] as number;
  let last: Reply | null = null;
  for (let i = 0; i < blockers.length; i += 1) {
    // every leave-out works the month again, which makes a new set of lines: read the first blocking line afresh each time
    const now = ((await call(HR, 'GET', `${M}/review?rows=100&severity=BLOCK`)).body.data as Body)['lines'][0] as Body;
    last = await expectStatus(`HR leaves ${String(now['name']).split(' (')[0]} out of this run`, HR, 'POST', `${M}/review/${now['id']}/leave-out`, 200, { reason: 'No pay profile yet', stateVersion: version, idempotencyKey: nextKey('out') });
    version = last.body.data?.['recalculated']?.stateVersion ?? version;
  }
  check('each leave-out worked the month again, and only the waiter and Lena are in the totals', (last?.body.data?.['recalculated']?.runNumber ?? 0) === 1 + blockers.length && last?.body.data?.['recalculated']?.headcount === 2, JSON.stringify(last?.body.data));
  const after = (await call(HR, 'GET', `${M}/review?rows=100`)).body.data as Body;
  check('no blocking line is left, and the lines of the people left out say so', after['counts'].blocking === 0 && after['lines'].filter((l: Body) => l['kind'] === 'LEFT_OUT' && l['state'] === 'CHECKED').length === blockers.length, JSON.stringify(after['counts']));
  const body = (v: number, over: Body = {}) => ({ employeeId: waiter.id, type: 'ALLOWANCE', label: 'Airtime', amount: '500', taxable: true, reason: 'Agreed with the Director', pin: PIN, idempotencyKey: nextKey('adj'), stateVersion: v, ...over });
  await expectCode('a wrong PIN on an added line', HR, 'POST', `${M}/adjustments`, 403, 'PIN_INVALID', body(after['stateVersion'], { pin: '0000' }));
  const added = await expectStatus('HR adds an airtime allowance for the waiter', HR, 'POST', `${M}/adjustments`, 201, body(after['stateVersion']));
  const adjusted = await slipOf(waiter.id);
  check('the waiter\'s payslip carries the line and a new gross', adjusted['lines'].some((l: Body) => l['code'] === 'ALLOWANCE' && l['amount'] === '500.00') && adjusted['totals'].gross === money(waiterGross + 50000n), JSON.stringify(adjusted['totals']));
  const nextVersion = (await call(HR, 'GET', M)).body.data?.['stateVersion'];
  await expectStatus('HR takes the line back out', HR, 'DELETE', `${M}/adjustments/${added.body.data?.['id']}`, 200, { stateVersion: nextVersion, idempotencyKey: nextKey('rm') });
  const open = (await call(HR, 'GET', `${M}/review?rows=100&state=OPEN`)).body.data as Body;
  for (const kind of new Set<string>(open['lines'].map((l: Body) => l['kind']))) await call(HR, 'POST', `${M}/review/check-kind`, { kind, stateVersion: open['stateVersion'] });
  for (const l of ((await call(HR, 'GET', `${M}/review?rows=100&state=OPEN`)).body.data as Body)['lines']) await call(HR, 'POST', `${M}/review/${l.id}/check`, { checked: true, stateVersion: open['stateVersion'] });
  const ready = (await call(HR, 'GET', `${M}/review?rows=100`)).body.data as Body;
  check('every line is checked; nothing changed since the calculation', ready['counts'].checked === ready['counts'].total && ready['stale'] === false, JSON.stringify([ready['counts'], ready['stale']]));

  out('\n== 5. send, send back, approve (the refusals first)');
  for (const who of [ACCOUNTANT, DIRECTOR, ADMIN]) await expectStatus('send to the Accountant', who, 'POST', `${M}/send-to-accountant`, 403, sendBody(ready['stateVersion']));
  const sendKey = nextKey('send');
  const sent = await expectStatus('HR sends September to the Accountant', HR, 'POST', `${M}/send-to-accountant`, 200, { idempotencyKey: sendKey, stateVersion: ready['stateVersion'] });
  check('a double click answers the first result', (await call(HR, 'POST', `${M}/send-to-accountant`, { idempotencyKey: sendKey, stateVersion: ready['stateVersion'] })).body.data?.['repeat'] === true);
  await expectCode('HR cannot change a line once sent', HR, 'POST', `${M}/review/${tickable?.id ?? ready['lines'][0].id}/check`, 409, 'MONTH_NOT_IN_REVIEW', { checked: false, stateVersion: sent.body.data?.['stateVersion'] });
  await expectCode('nor calculate again', HR, 'POST', `${M}/recalculate`, 409, 'MONTH_NOT_CALCULABLE', { idempotencyKey: nextKey('calc'), stateVersion: sent.body.data?.['stateVersion'] });
  const v1 = sent.body.data?.['stateVersion'] as number;
  const sheet = (await call(ACCOUNTANT, 'GET', M)).body.data as Body;
  check('the Accountant sees Approve and no review buttons', sheet['state'] === 'TO_APPROVE' && sheet['capabilities'].canApprove === true && sheet['capabilities'].canReview === false);
  await expectCode('the reason may not carry figures', ACCOUNTANT, 'POST', `${M}/send-back`, 400, 'VALIDATION_ERROR', { reason: 'Net 4,126,400 looks wrong', idempotencyKey: nextKey('back'), stateVersion: v1 });
  const back = await expectStatus('the Accountant sends it back with a reason', ACCOUNTANT, 'POST', `${M}/send-back`, 200, { reason: 'Please look at the overtime again', idempotencyKey: nextKey('back'), stateVersion: v1 });
  check('it is In review again and HR\'s ticks are kept', back.body.data?.['state'] === 'IN_REVIEW' && ((await call(HR, 'GET', `${M}/review?rows=100`)).body.data as Body)['counts'].checked === ready['counts'].checked);
  const resent = await expectStatus('HR sends it again', HR, 'POST', `${M}/send-to-accountant`, 200, sendBody(back.body.data?.['stateVersion']));
  const v2 = resent.body.data?.['stateVersion'] as number;
  const fresh = (await call(ACCOUNTANT, 'GET', `${M}/totals`)).body.data as Body;
  const t = fresh['total'];
  const approve = (over: Body = {}) => ({ pin: PIN, idempotencyKey: nextKey('approve'), stateVersion: v2, handChecked: true, expectedTotals: { gross: t.gross, net: t.net, taxStatutory: t.taxStatutory, other: t.other, headcount: t.people }, ...over });
  await expectStatus('HR cannot approve', HR, 'POST', `${M}/approve`, 403, approve());
  for (const who of [DIRECTOR, ADMIN, BM]) await expectStatus('approve', who, 'POST', `${M}/approve`, 403, approve());
  await expectCode('a wrong PIN', ACCOUNTANT, 'POST', `${M}/approve`, 403, 'PIN_INVALID', approve({ pin: '0000' }));
  await expectCode('the first month needs the hand check ticked', ACCOUNTANT, 'POST', `${M}/approve`, 409, 'HAND_CHECK_REQUIRED', approve({ handChecked: false }));
  await expectCode('figures that moved', ACCOUNTANT, 'POST', `${M}/approve`, 409, 'CHANGED_UNDERNEATH', approve({ expectedTotals: { gross: t.gross, net: '1.00', taxStatutory: t.taxStatutory, other: t.other, headcount: t.people } }));
  check('nothing was approved by any of that', ((await call(HR, 'GET', M)).body.data as Body)['state'] === 'TO_APPROVE');
  const key = nextKey('final');
  const done = await expectStatus('the Accountant approves September with their PIN', ACCOUNTANT, 'POST', `${M}/approve`, 200, approve({ idempotencyKey: key }));
  check('the document is PAY-2026-09 and the month is To publish', done.body.data?.['documentNumber'] === 'PAY-2026-09' && done.body.data['state'] === 'TO_PUBLISH', JSON.stringify(done.body.data));
  check('the same request again answers the first result', (await call(ACCOUNTANT, 'POST', `${M}/approve`, approve({ idempotencyKey: key }))).body.data?.['repeat'] === true);
  await expectCode('another key is too late', ACCOUNTANT, 'POST', `${M}/approve`, 409, 'ALREADY_APPROVED', approve());
  const row = await prisma.payrollMonth.findFirstOrThrow({ where: { companyId, monthKey: '2026-09' } });
  const snapshot = await prisma.payrollSnapshot.findMany({ where: { monthId: row.id } });
  check('the approver is not the person who sent it; one frozen snapshot with a hash', row.approvedById === accountantUser.id && row.sentById === hrUser.id && snapshot.length === 1 && snapshot[0]?.hash.length === 64);
  check('the Payslips tab is open from Approved, drafts visible to payroll readers only', ((await call(HR, 'GET', M)).body.data as Body)['tabs'].includes('payslips'));
  const entries = JSON.stringify(await prisma.auditEntry.findMany({ where: { companyId, subjectId: row.id }, select: { before: true, after: true, reason: true } }));
  check('the audit entries hold no PIN and no pay figure', !entries.includes(PIN) && !/"(gross|net|statutory)"/.test(entries));
  check('the payslip rows cannot be edited in the database', await prisma.payrollPayslip.updateMany({ where: { monthId: row.id }, data: { net: 1 } }).then(() => false, (e: Error) => /insert-only/.test(e.message)));

  out('\n== 6. one person is paid by one system: the old run leaves Nyeri Town September alone');
  const oldRow = (siteId: string, payPeriod: string) => ({ payPeriod, siteId, rows: [{ userId: hrUser.id, payDate: '2026-09-30', grossPay: '100', paye: '1', sha: '1', nssfTier1: '1', nssfTier2: '0', housingLevy: '1' }] });
  await expectCode('save an old payslip for the covered site and month', HR, 'POST', '/payslips/bulk-upsert', 409, 'PAID_IN_NEW_PAYROLL', oldRow(townId, '2026-09'));
  await expectCode('publish', HR, 'POST', '/payslips/publish', 409, 'PAID_IN_NEW_PAYROLL', { payPeriod: '2026-09', siteId: townId });
  await expectCode('revert', HR, 'POST', '/payslips/revert', 409, 'PAID_IN_NEW_PAYROLL', { payPeriod: '2026-09', siteId: townId });
  const highway = (await prisma.user.findUniqueOrThrow({ where: { email: HIGHWAY }, select: { siteId: true } })).siteId as string;
  const other = await expectStatus('another site: the old run works as before (revert of nothing)', HR, 'POST', '/payslips/revert', 200, { payPeriod: '2026-09', siteId: highway });
  check('and answers its normal count', other.body.data?.['count'] === 0, JSON.stringify(other.body.data));
  await expectStatus('Nyeri Town before the switch (August): the old run is untouched', HR, 'POST', '/payslips/revert', 200, { payPeriod: '2026-08', siteId: townId });
  await expectStatus('the old list stays readable for the covered month', HR, 'GET', `/payslips?siteId=${townId}&payPeriod=2026-09`, 200);
  check('no legacy payslip, shift or clock row changed', (await legacy()) === legacyBefore, `${legacyBefore} -> ${await legacy()}`);

  out('\n== 7. the Director\'s estimate, and the switch that cannot go off while the month is unpaid');
  const estimates = await refreshPayrollEstimates();
  check('the nightly job stored the estimate for the running month', estimates.computed >= 1 && estimates.failed === 0, JSON.stringify(estimates));
  const estimate = await expectStatus('the Director reads October\'s estimate', DIRECTOR, 'GET', `${P}/months/2026-10/estimate`, 200);
  check('it is stored (not worked out in the request), gross only, with Nyeri Town', estimate.body.data?.['ready'] === true && estimate.body.data['estimate'].bySite.some((s: Body) => s['organizationId'] === townId), JSON.stringify(estimate.body.data).slice(0, 300));
  for (const [who, status] of [[HR, 200], [ACCOUNTANT, 200], [ADMIN, 200], [BM, 403], [WAITER, 403]] as const) await expectStatus('read the estimate', who, 'GET', `${P}/months/2026-10/estimate`, status);
  await expectCode('System Admin cannot switch Nyeri Town off while September is unpaid', ADMIN, 'PUT', '/workforce/attendance/switch', 409, 'SITE_IN_UNPAID_PAYROLL', { siteId: townId, enabled: false });
  const list2 = (await call(DIRECTOR, 'GET', `${P}/months`)).body.data as Body;
  check('the months list shows September To publish with its net, and October open', list2['items'].some((i: Body) => i['monthKey'] === '2026-09' && i['state'] === 'TO_PUBLISH' && i['netPay'] === t.net));

  out('\n== 8. integrity');
  const log = await prisma.auditEntry.findMany({ where: { companyId }, orderBy: { seq: 'asc' } });
  const chain = verifyAuditChain(log.map((r) => ({ ...r, category: r.category as AuditCategoryCode, channel: r.channel as AuditEntryRecord['channel'], before: r.before as AuditEntryRecord['before'], after: r.after as AuditEntryRecord['after'] })));
  check('the audit chain verifies', chain.ok === true, JSON.stringify(chain, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
  out(`\n${passed} passed, ${failed} failed. Data left in place: run "down" (then timesheets-proof down) to remove it.`);
  if (failed > 0) process.exitCode = 1;
}

const mode = process.argv[2];
(mode === 'down' ? down() : mode === 'up' ? up() : Promise.reject(new Error('usage: payroll-proof.ts up|down')))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
