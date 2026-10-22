/**
 * Makes the People section look like a real company: about 25 more people hired through the real API, probation, notice and exit cases,
 * heads and an acting head, pay changes waiting, a bank change, a Branch Manager hire made today. Dates are relative to today (Nairobi).
 */
import { prisma } from '../../../config/database';
import { toDateColumn, type NairobiDate } from '../../../modules/workforce';
import { call, key, login, must, PIN, type Body } from './api';
import { avatar, out, type World } from './base';
import { DEMO_PASSWORD, emailOf, type SiteKey } from './roster';

const TODAY = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10);
const inDays = (n: number): string => new Date(Date.parse(`${TODAY}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const col = (iso: string): Date => toDateColumn(iso as NairobiDate);
const BANKS = ['Equity Bank', 'KCB', 'Family Bank', 'Co-operative Bank'];

interface Hire {
  local: string; name: string; site: SiteKey; dept: string; position: string; salary: number; start: number; // start = days before today
  login?: boolean; noBank?: boolean; probationEndsIn?: number; photo?: boolean;
}
const H = (local: string, name: string, site: SiteKey, dept: string, position: string, salary: number, start: number, more: Partial<Hire> = {}): Hire => ({ local, name, site, dept, position, salary, start, ...more });

const HIRES: Hire[] = [
  H('grace.wanjiku', 'Grace Wanjiku', 'TOWN', 'SERVICE', 'Waiter', 27000, 400, { login: true, photo: true }),
  H('samuel.githinji', 'Samuel Githinji', 'TOWN', 'KITCHEN', 'Chef', 36000, 300, { photo: true }),
  H('lilian.nyambura', 'Lilian Nyambura', 'TOWN', 'BARISTA', 'Barista', 31000, 200, { login: true }),
  H('martin.ochieng', 'Martin Ochieng', 'TOWN', 'KITCHEN', 'Steward', 24000, 500),
  H('rebecca.wairimu', 'Rebecca Wairimu', 'TOWN', 'HOUSEKEEPING', 'Housekeeper', 22000, 250, { login: true, photo: true }),
  H('tabitha.muriuki', 'Tabitha Muriuki', 'TOWN', 'HOUSEKEEPING', 'Housekeeper', 22000, 150),
  H('elijah.kariuki', 'Elijah Kariuki', 'TOWN', 'PASTRY', 'Chef', 34000, 350),
  H('hellen.nduta', 'Hellen Nduta', 'TOWN', 'SERVICE', 'Waiter', 26000, 90),
  H('ann.wangui', 'Ann Wangui', 'TOWN', 'SERVICE', 'Waiter', 25000, 96, { login: true, probationEndsIn: -6 }), // decision overdue
  H('kennedy.mugo', 'Kennedy Mugo', 'TOWN', 'BARISTA', 'Barista', 28000, 80, { probationEndsIn: 10 }), // decision due in 10 days
  H('jackline.wavinya', 'Jackline Wavinya', 'TOWN', 'KITCHEN', 'Chef', 33000, 46, { login: true }), // the Kitchen head's report is due
  H('moses.kibet', 'Moses Kibet', 'HIGHWAY', 'KITCHEN', 'Chef', 35000, 380, { photo: true }),
  H('winnie.cherono', 'Winnie Cherono', 'HIGHWAY', 'BARISTA', 'Barista', 30000, 260),
  H('gideon.rotich', 'Gideon Rotich', 'HIGHWAY', 'SERVICE', 'Waiter', 25000, 210, { login: true }),
  H('mercy.kerubo', 'Mercy Kerubo', 'HIGHWAY', 'PASTRY', 'Chef', 38000, 300, { photo: true }),
  H('agnes.wanjiru', 'Agnes Wanjiru', 'HIGHWAY', 'HOUSEKEEPING', 'Housekeeper', 22000, 200),
  H('eric.mburu', 'Eric Mburu', 'HIGHWAY', 'SERVICE', 'Waiter', 24000, 120),
  H('lydia.njambi', 'Lydia Njambi', 'HIGHWAY', 'KITCHEN', 'Steward', 23000, 60, { noBank: true }), // incomplete file
  H('collins.bett', 'Collins Bett', 'HIGHWAY', 'BARISTA', 'Barista', 29000, 20),
  H('brenda.achieng', 'Brenda Achieng', 'HIGHWAY', 'SERVICE', 'Waiter', 26000, 450), // goes on notice
  H('joel.kiplagat', 'Joel Kiplagat', 'HIGHWAY', 'KITCHEN', 'Chef', 34000, 500), // has left
];

let counter = 0;
const next = (): number => (counter += 1);

async function hire(world: World, h: Hire, positions: Map<string, string>): Promise<string> {
  const n = next();
  const departmentId = world.departments.get(`${h.site}:${h.dept}`);
  const positionId = positions.get(h.position);
  if (!departmentId || !positionId) throw new Error(`hire ${h.name}: department or position missing`);
  const loginRole = h.position === 'Chef' ? 'CHEF' : h.position === 'Barista' ? 'BARISTA' : h.position === 'Housekeeper' ? 'HOUSEKEEPING' : h.position === 'Steward' ? 'STEWARD' : 'WAITER';
  const body = {
    who: { name: h.name, phone: `07${String(20000000 + n * 7919).slice(0, 8)}`, nationalId: String(31000000 + n * 7717), email: `${h.local}@personal.demo.wendo.test`, ...(h.photo ? { photoUrl: avatar(h.name, n) } : {}) },
    job: { siteId: world.siteIds[h.site], departmentId, positionId, employment: h.noBank ? 'MONTHLY_NO_CONTRACT_YET' : 'MONTHLY_WITH_CONTRACT', startDate: inDays(-h.start) },
    pay: { amount: String(h.salary), overtimeEligible: true, standardWeekHours: '48', standardDayHours: '8' },
    ...(h.noBank ? {} : { statutory: { kraPin: `A${String(100000000 + n * 1373).slice(0, 9)}Z`, nssfNumber: `NS${600000 + n}`, shaNumber: `SH${800000 + n}`, payoutMethod: 'BANK', bankName: BANKS[n % 4], accountName: h.name, accountNumber: `9999100${100 + n}` } }),
    ...(h.login ? { login: { email: emailOf(h.local), loginRole, temporaryPassword: DEMO_PASSWORD } } : {}),
    confirmDuplicatePhone: true,
  };
  const made = await must(`hire ${h.name}`, 'hr', 'POST', '/workforce/people', body, { 'Idempotency-Key': key('hire') });
  const id = (made['id'] ?? made['employee']?.id ?? made['employeeId']) as string | undefined;
  if (!id) throw new Error(`hire ${h.name}: no id in ${JSON.stringify(made).slice(0, 200)}`);
  if (h.probationEndsIn !== undefined) await prisma.employee.update({ where: { id }, data: { probationEndsOn: col(inDays(h.probationEndsIn)) } });
  else if (h.start >= 90) {
    // Long-serving people were confirmed when their probation ended (lane database only; the app has no way to record the past).
    const ended = col(inDays(-h.start + 91));
    await prisma.employee.update({ where: { id }, data: { probationEndsOn: ended, probationDecidedOn: ended, probationConfirmedOn: ended } });
  }
  return id;
}

export async function runMorePeople(world: World): Promise<void> {
  const positions = new Map((await prisma.position.findMany({ where: { companyId: world.companyId } })).map((p) => [p.name, p.id]));

  // Which jobs each branch department offers (the reset leaves this table empty, and a hire is refused without it).
  const offers: Record<string, string[]> = { KITCHEN: ['Chef', 'Steward'], PASTRY: ['Chef'], BARISTA: ['Barista'], SERVICE: ['Waiter'], HOUSEKEEPING: ['Housekeeper', 'Steward'] };
  for (const [tag, names] of Object.entries(offers)) {
    for (const site of ['TOWN', 'HIGHWAY'] as const) {
      const departmentId = world.departments.get(`${site}:${tag}`);
      if (departmentId) await prisma.departmentPosition.createMany({ data: names.map((n) => ({ departmentId, positionId: positions.get(n)! })), skipDuplicates: true });
    }
  }

  // The Central Store staff get a department and a job (the "Job details missing" gap).
  const hubDept = async (name: string, positionNames: string[]): Promise<string> => {
    const made = await must(`department ${name}`, 'hr', 'POST', '/workforce/org/departments', { siteId: world.siteIds.HUB, name, positionIds: positionNames.map((p) => positions.get(p)!) });
    return (made['id'] ?? made['department']?.id) as string;
  };
  const store = await hubDept('Store', ['Store Manager', 'Store Attendant']);
  const office = await hubDept('Head Office', ['HR Manager', 'Accountant', 'Director']);
  const hubMap: [string, string][] = [['store.manager', store], ['kevin.mutua', store], ['hr', office], ['accountant', office], ['director', office]];
  for (const [local, departmentId] of hubMap) {
    const id = world.employeeIds.get(local)!;
    await prisma.employee.update({ where: { id }, data: { departmentId } });
    await prisma.user.updateMany({ where: { employee: { id } }, data: { departmentId } });
  }
  const hassan = await must('hire Hassan', 'hr', 'POST', '/workforce/people', {
    who: { name: 'Hassan Abdi', phone: '0722000111', nationalId: '31999001', email: 'hassan.abdi@personal.demo.wendo.test' },
    job: { siteId: world.siteIds.HUB, departmentId: store, positionId: positions.get('Store Attendant'), employment: 'MONTHLY_WITH_CONTRACT', startDate: inDays(-140) },
    pay: { amount: '30000', overtimeEligible: true, standardWeekHours: '48', standardDayHours: '8' },
    statutory: { kraPin: 'A987654321Z', nssfNumber: 'NS650001', shaNumber: 'SH850001', payoutMethod: 'BANK', bankName: 'Equity Bank', accountName: 'Hassan Abdi', accountNumber: '9999100900' },
    login: { email: emailOf('hassan.abdi'), loginRole: 'STORE_ATTENDANT', temporaryPassword: DEMO_PASSWORD }, confirmDuplicatePhone: true,
  }, { 'Idempotency-Key': key('hire') });

  const ids = new Map<string, string>();
  for (const h of HIRES) ids.set(h.local, await hire(world, h, positions));
  const hassanDone = col(inDays(-140 + 91));
  await prisma.employee.updateMany({ where: { name: 'Hassan Abdi' }, data: { probationEndsOn: hassanDone, probationDecidedOn: hassanDone, probationConfirmedOn: hassanDone } });
  out(`ok  people: ${HIRES.length + 1} more people hired through the app (HR)`);

  // Heads: an acting head in Town Housekeeping; Highway Housekeeping and Highway Pastry stay without a head.
  const townHk = world.departments.get('TOWN:HOUSEKEEPING')!;
  await must('acting head', 'hr', 'POST', `/workforce/org/departments/${townHk}/head`, { employeeId: ids.get('rebecca.wairimu'), mode: 'ACTING', returnsOn: inDays(60), reason: 'Covering until a head is chosen' });
  const townPastry = world.departments.get('TOWN:PASTRY')!;
  void townPastry;

  // Probation: the head's report is due for Jackline (day 46, Kitchen head has a login); the other two are set by their dates above.
  await prisma.employee.update({ where: { id: ids.get('jackline.wavinya')! }, data: { probationEndsOn: col(inDays(44)) } });

  // Notice and exit.
  await must('notice', 'hr', 'POST', `/workforce/people/${ids.get('brenda.achieng')}/exit`, { lastDay: inDays(14), reason: 'RESIGNED', note: 'Moving to Nairobi', uniformReturned: false });
  await must('exit', 'hr', 'POST', `/workforce/people/${ids.get('joel.kiplagat')}/exit`, { lastDay: inDays(-3), reason: 'END_OF_CONTRACT', uniformReturned: true });
  out('ok  people: probation cases, an acting head, one on notice, one exited');

  // Pay changes: one waiting for the Director, one already approved that starts next month.
  const waiting = await must('pay change', 'hr', 'POST', `/workforce/people/${world.employeeIds.get('victor.mutua')}/pay-changes`, { amount: '48000', effectiveFrom: inDays(10), reason: 'ANNUAL_REVIEW', note: 'Yearly review', pin: PIN });
  const nextMonth = `${TODAY.slice(0, 5)}${String(Number(TODAY.slice(5, 7)) + 1).padStart(2, '0')}-01`;
  const approved = await must('pay change 2', 'hr', 'POST', `/workforce/people/${world.employeeIds.get('susan.wafula')}/pay-changes`, { amount: '39000', effectiveFrom: nextMonth, reason: 'PROMOTION', note: 'Service head allowance', pin: PIN });
  const changeId = (approved['id'] ?? approved['change']?.id) as string;
  await must('decide pay change', 'director', 'POST', `/workforce/people/pay-changes/${changeId}/decision`, { decision: 'APPROVE', pin: PIN });
  void waiting;

  // A bank change the Accountant must be told about.
  await must('bank change', 'hr', 'PUT', `/workforce/people/${world.employeeIds.get('cynthia.muthoni')}/pay-profile`, { bankName: 'Co-operative Bank', accountName: 'Cynthia Muthoni', accountNumber: '9999200555', reason: 'She changed banks' });

  // A Branch Manager hire made today (the 24-hour correction shows).
  await login('bm.town');
  const dorcasDept = world.departments.get('TOWN:SERVICE')!;
  await must('manager hire', 'bm.town', 'POST', '/workforce/people', {
    who: { name: 'Dorcas Naliaka', phone: '0733000222', nationalId: '32000333' },
    job: { siteId: world.siteIds.TOWN, departmentId: dorcasDept, positionId: positions.get('Waiter'), employment: 'MONTHLY_NO_CONTRACT_YET', startDate: TODAY },
  }, { 'Idempotency-Key': key('hire') });

  // A casual worker hired through People (daily rate, no bank step). The app gives a casual no login, so none is forced here.
  await must('casual hire', 'hr', 'POST', '/workforce/people', {
    who: { name: 'Stella Moraa', phone: '0744000333', nationalId: '32111444' },
    job: { siteId: world.siteIds.TOWN, departmentId: dorcasDept, positionId: positions.get('Waiter'), employment: 'CASUAL', startDate: inDays(-30) },
    pay: { amount: '900' },
  }, { 'Idempotency-Key': key('hire') });

  // Photos for the people hired with one are set in the hire; give a few of the seed people none (the seed gave all a photo).
  for (const local of ['daniel.gitau', 'brian.kiprop', 'paul.odhiambo']) await prisma.employee.update({ where: { id: world.employeeIds.get(local)! }, data: { photoUrl: null } });
  void hassan;
  const total = await prisma.employee.count();
  out(`ok  people: ${total} people on file`);
}
