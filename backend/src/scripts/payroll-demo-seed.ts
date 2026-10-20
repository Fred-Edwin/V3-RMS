/**
 * Workforce Segment 2: a branch-sized Payroll demo on the LANE database, for a browser walkthrough. Not a test.
 * Builds on `timesheets-demo-seed.ts up` (24 people in Nyeri Town, September left unapproved). Run that first, with the same API.
 *   up    gives the 24 people pay (a spread of salaries, bank and M-Pesa, two with no bank details, one with no pay profile), saves and
 *         confirms the tax tables and overtime rates (the Accountant, with a PIN), settles the overtime to decide and the open shift,
 *         has the Branch Manager approve September's timesheets with a PIN, and lets the system calculate. September ends In review:
 *         24 people, one blocking line, some lines to tick. Nothing past review is done: walk the rest by hand.
 *   down  removes the payroll data this made (the audit entries stay: the log is append-only). Then run `timesheets-demo-seed.ts down`.
 * Logins (password123, PIN 4321): hr@, accountant@, director@, admin@, demo.bm@wendo.test.
 * Usage: API=http://localhost:4101 pnpm exec tsx src/scripts/payroll-demo-seed.ts up|down
 */
import 'dotenv/config';
import { prisma } from '../config/database';
import { instantAt, parseClockTime, sweepPayroll, toDateColumn, type NairobiDate } from '../modules/workforce';
import { comparePin, hashPin } from '../utils/password';

const API = `${process.env['API'] ?? 'http://localhost:4101'}/api/v1`;
const TAG = 'ZZ Demo Pay';
const PASSWORD = 'password123';
const PIN = '4321';
const PREFIX = 'ZZD-';
const HR = 'hr@wendo.test';
const ACCOUNTANT = 'accountant@wendo.test';
const DIRECTOR = 'director@wendo.test';
const ADMIN = 'admin@wendo.test';
const MANAGER = 'demo.bm@wendo.test';
const TOWN_BM = 'bm.town@wendo.test';
const out = (line: string): void => void process.stdout.write(`${line}\n`);

type Body = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- loose JSON from the API
const tokens = new Map<string, string>();
const login = async (email: string): Promise<void> => {
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const json = (await res.json()) as { data?: { accessToken?: string } };
  if (!json.data?.accessToken) throw new Error(`login failed for ${email}`);
  tokens.set(email, json.data.accessToken);
};
const call = async (who: string, method: string, path: string, body?: object): Promise<{ status: number; data: Body | undefined; error: string }> => {
  const res = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.get(who)}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const json = (await res.json().catch(() => ({}))) as { data?: Body; error?: { code?: string; message?: string } };
  return { status: res.status, data: json.data, error: `${json.error?.code ?? ''} ${json.error?.message ?? ''}`.trim() };
};
const must = async (label: string, who: string, method: string, path: string, body?: object): Promise<Body | undefined> => {
  const reply = await call(who, method, path, body);
  if (reply.status >= 300) throw new Error(`${label} failed: ${reply.status} ${reply.error}`);
  out(`ok  ${label}`);
  return reply.data;
};
let keyCount = 0;
const nextKey = (label: string): string => `demo-${label}-${Date.now()}-${(keyCount += 1)}`;

/** Monthly salary by department, then a repeatable spread around it. */
const BASE: Record<string, number> = { KITCHEN: 36000, PASTRY: 33000, BARISTA: 30000, SERVICE: 26000 };
const BANKS = ['Equity Bank', 'KCB', 'Co-operative Bank', 'Family Bank'];

async function down(): Promise<void> {
  const town = await prisma.user.findUniqueOrThrow({ where: { email: TOWN_BM }, select: { siteId: true, site: { select: { companyId: true } } } });
  const people = await prisma.employee.findMany({ where: { employeeNumber: { startsWith: PREFIX } }, select: { id: true } });
  const ids = people.map((p) => p.id);
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
  const versions = await prisma.ruleVersion.findMany({ where: { reason: { startsWith: TAG } }, select: { id: true } });
  await prisma.ruleConfirmation.deleteMany({ where: { ruleVersionId: { in: versions.map((v) => v.id) } } });
  await prisma.ruleVersion.deleteMany({ where: { id: { in: versions.map((v) => v.id) } } });
  for (const email of [HR, ACCOUNTANT, DIRECTOR]) {
    const u = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, pinHash: true } });
    if (u.pinHash && (await comparePin(PIN, u.pinHash))) await prisma.user.update({ where: { id: u.id }, data: { pinHash: null } }); // only the PIN this demo set
  }
  out('removed the payroll demo data (months, runs, payslips, pay of the demo people, the demo rule versions). Now run timesheets-demo-seed down.');
}

async function up(): Promise<void> {
  const town = await prisma.user.findUniqueOrThrow({ where: { email: TOWN_BM }, select: { siteId: true, site: { select: { companyId: true } } } });
  const townId = town.siteId as string;
  const companyId = town.site!.companyId;
  const people = await prisma.employee.findMany({ where: { employeeNumber: { startsWith: PREFIX } }, orderBy: { employeeNumber: 'asc' }, include: { department: { select: { key: true } } } });
  if (people.length < 24) throw new Error('Run timesheets-demo-seed.ts up first: it makes the people and the clock days.');
  const ordered = [...people].sort((a, b) => Number(a.employeeNumber.slice(PREFIX.length)) - Number(b.employeeNumber.slice(PREFIX.length)));
  const accountantUser = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNTANT }, select: { id: true } });
  const hrUser = await prisma.user.findUniqueOrThrow({ where: { email: HR }, select: { id: true } });

  const pinHash = await hashPin(PIN);
  for (const email of [HR, ACCOUNTANT, DIRECTOR]) await prisma.user.update({ where: { email }, data: { pinHash } });
  const since = toDateColumn('2026-09-01' as NairobiDate);

  // Pay: everyone but the 23rd person (no pay profile, so a blocking line); the 7th and 15th have no bank details.
  for (const [i, emp] of ordered.entries()) {
    const n = i + 1;
    await prisma.employmentSpell.create({ data: { employeeId: emp.id, startsOn: n === 24 ? toDateColumn('2026-09-14' as NairobiDate) : since } });
    await prisma.employee.update({ where: { id: emp.id }, data: { kraPin: `A00${String(n).padStart(4, '0')}Z`, nssfNumber: `NS${String(n).padStart(6, '0')}`, shaNumber: `SH${String(n).padStart(6, '0')}` } });
    if (n === 23) continue;
    const key = emp.department?.key ?? 'SERVICE';
    const amount = String((BASE[key] ?? 26000) + (n % 5) * 2500 + (n % 3 === 0 ? 4000 : 0));
    const mpesa = n % 4 === 0;
    const noBank = n === 7 || n === 15;
    await prisma.payProfile.create({
      data: {
        employeeId: emp.id, amount, overtimeEligible: true, standardWeekHours: '48', standardDayHours: '8',
        payoutMethod: mpesa ? 'MPESA' : 'BANK',
        ...(mpesa ? { mpesaPhone: `07${String(10000000 + n * 137).slice(0, 8)}` } : noBank ? {} : { bankName: BANKS[n % BANKS.length]!, accountName: emp.name, accountNumber: `01${String(2000000 + n * 7919)}` }),
      },
    });
    await prisma.payChange.create({ data: { employeeId: emp.id, amount, effectiveFrom: since, reason: TAG, status: 'APPROVED', requestedById: hrUser.id, decidedById: accountantUser.id, decidedAt: new Date() } });
  }
  out(`gave ${ordered.length - 1} people pay (9 on M-Pesa, 2 with no bank details); the 23rd has no pay profile`);

  const tables = {
    tables: [
      { code: 'NSSF', name: 'Alpha', bands: [{ fromAmount: '0', toAmount: null, ratePercent: '6', flatAmount: null }], note: null, kind: 'RATE', base: 'GROSS', reducesTaxable: true, isIncomeTax: false, employerRatePercent: '6', reliefMonthly: null, floorAmount: null, ceilingAmount: null },
      { code: 'PAYE', name: 'Gamma', bands: [{ fromAmount: '0', toAmount: '24000', ratePercent: '10', flatAmount: null }, { fromAmount: '24000', toAmount: '32333', ratePercent: '25', flatAmount: null }, { fromAmount: '32333', toAmount: null, ratePercent: '30', flatAmount: null }], note: null, kind: 'BANDS', base: 'TAXABLE', reducesTaxable: false, isIncomeTax: true, employerRatePercent: null, reliefMonthly: '2000', floorAmount: null, ceilingAmount: null },
    ],
  };
  const next = async (group: 'STATUTORY' | 'OVERTIME') => ((await prisma.ruleVersion.aggregate({ where: { companyId, siteId: null, group }, _max: { version: true } }))._max.version ?? 0) + 1;
  const statutory = await prisma.ruleVersion.create({ data: { companyId, group: 'STATUTORY', version: await next('STATUTORY'), effectiveFrom: since, values: tables, reason: `${TAG} tax tables`, createdById: accountantUser.id, createdByRole: 'ACCOUNTANT' } });
  const overtimeRules = await prisma.ruleVersion.create({ data: { companyId, group: 'OVERTIME', version: await next('OVERTIME'), effectiveFrom: since, values: { serviceTailMinutes: 15, weeklyCapMinutes: null, branchBudgetMinutesPerPeriod: null, approvalWindowHours: 48, multipliers: { ordinaryDay: '1.5', restDay: '2' } }, reason: `${TAG} overtime rates`, createdById: accountantUser.id, createdByRole: 'ACCOUNTANT' } });

  for (const email of [HR, ACCOUNTANT, ADMIN, MANAGER]) await login(email);

  // The open shift on 17 September: add the missing clock-out (the demo seed left it open on purpose for the timesheet walk).
  const sixth = ordered[5]!; // the demo seed leaves person 6 (index 5) clocked in on 17 September
  const day = '2026-09-17' as NairobiDate;
  const outAt = instantAt(day, parseClockTime('14:02'));
  const hasOut = await prisma.clockEvent.count({ where: { employeeId: sixth.id, shiftDate: toDateColumn(day), type: 'OUT' } });
  if (hasOut === 0) {
    const entry = await prisma.rotaEntry.findFirst({ where: { employeeId: sixth.id, date: toDateColumn(day) }, select: { id: true } });
    await prisma.clockEvent.create({ data: { siteId: townId, employeeId: sixth.id, shiftDate: toDateColumn(day), type: 'OUT', source: 'PHONE', occurredAt: outAt, serverAt: outAt, rotaEntryId: entry?.id ?? null } });
  }
  await call(MANAGER, 'GET', `/workforce/timesheets/months/2026-09?site=${townId}`); // assemble the days again

  // Overtime to decide: all of it, except one declined with a reason.
  const items = await prisma.overtimeItem.findMany({ where: { siteId: townId, status: 'PENDING', shiftDate: { lte: toDateColumn('2026-09-30' as NairobiDate) } }, orderBy: { shiftDate: 'asc' }, select: { id: true } });
  for (const [i, item] of items.entries()) {
    const card = await call(MANAGER, 'GET', `/workforce/timesheets/overtime/${item.id}`);
    const version = (card.data as Body | undefined)?.['version'];
    const decision = i === 1 ? { decision: 'DECLINE', reason: 'Not needed at that hour', pin: PIN, version } : { decision: 'APPROVE_ALL', pin: PIN, version };
    await must(`overtime ${i + 1} of ${items.length}: ${decision.decision}`, MANAGER, 'POST', `/workforce/timesheets/overtime/${item.id}/decision`, decision);
  }

  const sheet = (await must('read September for approval', MANAGER, 'GET', `/workforce/timesheets/months/2026-09?site=${townId}`)) as Body;
  const expectedTotals = { workedMinutes: sheet['kpis'].workedMinutes, overtimeAuthorisedMinutes: sheet['kpis'].overtime.approvedMinutes, headcount: sheet['kpis'].headcount };
  await must('the Branch Manager approves September timesheets', MANAGER, 'POST', '/workforce/timesheets/months/2026-09/approve', { pin: PIN, idempotencyKey: nextKey('approve'), expectedTotals, site: townId });

  await must('the Accountant confirms the tax tables', ACCOUNTANT, 'POST', `/workforce/rules/versions/${statutory.id}/confirm`, { scope: 'statutory', pin: PIN });
  await must('the Accountant confirms the overtime rates', ACCOUNTANT, 'POST', `/workforce/rules/versions/${overtimeRules.id}/confirm`, { scope: 'overtime.multipliers', pin: PIN });
  const swept = await sweepPayroll();
  out(`the sweep calculated ${swept.calculated} month(s)`);
  const month = (await must('HR opens September', HR, 'GET', '/workforce/payroll/months/2026-09')) as Body;
  out(`September is ${month['state']}: ${month['kpis']?.headcount} people, ${month['kpis']?.openLines} lines to tick, ${month['kpis']?.blockingLines} blocking`);
  out('\nDone. Walk it as hr@ / accountant@ / director@wendo.test (password123, PIN 4321).');
}

const mode = process.argv[2];
(mode === 'up' ? up() : mode === 'down' ? down() : Promise.reject(new Error('Usage: payroll-demo-seed.ts up|down')))
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
