/** The demo's foundation: reset, sites, departments, logins, people and their pay. Prisma writes; the rules of the app are not involved. */
import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { departmentLinks } from '../../../modules/inventory/departments/department-links';
import { toDateColumn, type NairobiDate } from '../../../modules/workforce';
import { hashPassword, hashPin } from '../../../utils/password';
import { ADMIN, DEMO_PASSWORD, DEMO_PIN, PEOPLE, SITES, emailOf, type Person, type SiteKey } from './roster';

const KEEP = ['_prisma_migrations', 'companies', 'positions'];
export const out = (line: string): void => void process.stdout.write(`${line}\n`);
const date = (iso: string): Date => toDateColumn(iso as NairobiDate);

/** Wipes every table except the company and the positions the migrations make. Only ever on a throwaway lane database. */
export async function resetLane(): Promise<void> {
  const name = (await prisma.$queryRaw<{ current_database: string }[]>`SELECT current_database()`)[0]?.current_database ?? '';
  if (!/_lane\d+$/.test(name)) throw new Error(`Refusing to reset "${name}": only a _laneN database may be reset.`);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  const list = tables.map((t) => t.tablename).filter((t) => !KEEP.includes(t)).map((t) => `"${t}"`);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica'); // the append-only guards are triggers; a lane reset is the one legitimate way past them
    await tx.$executeRawUnsafe(`TRUNCATE ${list.join(', ')} RESTART IDENTITY CASCADE`);
  }, { timeout: 60000 });
  out(`reset ${name}: ${list.length} tables emptied (company and positions kept)`);
}

export interface World {
  companyId: string;
  siteIds: Record<SiteKey, string>;
  employeeIds: Map<string, string>; // roster email local part -> employee id
  userIds: Map<string, string>;
  departments: Map<string, string>; // `${site}:${tag}` -> department id
}

export async function seedBase(): Promise<World> {
  const company = await prisma.company.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
  await prisma.company.update({ where: { id: company.id }, data: { name: 'Wendo Coffee Bistro' } });
  const siteIds = {} as Record<SiteKey, string>;
  for (const s of SITES) {
    const site = await prisma.site.create({
      data: { companyId: company.id, name: s.name, code: s.code, type: s.hub ? 'CENTRAL_STORE' : 'BRANCH', isHub: s.hub, address: s.address, city: 'Nyeri', latitude: s.lat, longitude: s.lng, phone: '0700000000' },
    });
    siteIds[s.key] = site.id;
    if (!s.hub) await departmentLinks.provisionBranch({ id: site.id, name: site.name });
  }
  const departments = new Map<string, string>();
  for (const key of ['TOWN', 'HIGHWAY'] as const) {
    for (const d of await prisma.department.findMany({ where: { siteId: siteIds[key] } })) departments.set(`${key}:${d.key ?? ''}`, d.id);
  }
  const positions = new Map((await prisma.position.findMany({ where: { companyId: company.id } })).map((p) => [p.name, p.id]));
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const pinHash = await hashPin(DEMO_PIN);

  const admin = await prisma.user.create({ data: { name: ADMIN.name, email: emailOf(ADMIN.email), passwordHash, pinHash, role: ADMIN.role, siteId: siteIds.HUB, isTestUser: false } });
  const userIds = new Map<string, string>([[ADMIN.email, admin.id]]);
  const employeeIds = new Map<string, string>();
  const heads = new Map<string, string>(); // `${site}:${dept}` -> employee id
  const bms = new Map<string, string>();

  const ordered = [...PEOPLE].sort((a, b) => Number(!!b.head) - Number(!!a.head)); // heads first so others can report to them
  for (const [i, p] of ordered.entries()) {
    const deptId = p.dept ? departments.get(`${p.site}:${p.dept}`) : undefined;
    const user = await prisma.user.create({
      data: { name: p.name, email: emailOf(p.email), passwordHash, pinHash, role: p.role, siteId: siteIds[p.site], phone: phone(i), ...(deptId ? { departmentId: deptId, departmentTag: p.dept! } : {}), isDepartmentHead: !!p.head },
    });
    userIds.set(p.email, user.id);
    const tracked = !['MANAGER', 'DIRECTOR', 'HR_MANAGER', 'ACCOUNTANT', 'STORE_MANAGER'].includes(p.role);
    const reportsTo = p.role === 'MANAGER' ? undefined : (p.dept && heads.get(`${p.site}:${p.dept}`)) || bms.get(p.site);
    const emp = await prisma.employee.create({
      data: {
        companyId: company.id, siteId: siteIds[p.site], userId: user.id, employeeNumber: `WND-${String(PEOPLE.indexOf(p) + 1).padStart(3, '0')}`, name: p.name,
        positionId: positions.get(p.position) ?? null, ...(deptId ? { departmentId: deptId } : {}), ...(reportsTo ? { reportsToId: reportsTo } : {}),
        status: 'ACTIVE', contractStatus: 'ACTIVE', photoUrl: avatar(p.name, i), payType: 'MONTHLY_SALARY', tracksTime: tracked, startDate: date(p.start), probationConfirmedOn: date(p.start),
        nationalId: String(30000000 + PEOPLE.indexOf(p) * 7919), kraPin: `A0${String(10000000 + PEOPLE.indexOf(p) * 137)}Z`, nssfNumber: `NS${String(500000 + PEOPLE.indexOf(p))}`, shaNumber: `SH${String(700000 + PEOPLE.indexOf(p))}`,
        dateOfBirth: date(`${1984 + (i % 16)}-0${(i % 9) + 1}-1${i % 9}`), personalPhone: phone(i), physicalAddress: 'Nyeri', emergencyName: 'Demo Contact', emergencyRelation: 'Sibling', emergencyPhone: phone(i + 40),
      },
    });
    employeeIds.set(p.email, emp.id);
    if (p.role === 'MANAGER') bms.set(p.site, emp.id);
    if (p.head && deptId) {
      heads.set(`${p.site}:${p.dept}`, emp.id);
      await prisma.departmentHead.create({ data: { departmentId: deptId, employeeId: emp.id, startsOn: date(p.start) } });
    }
  }
  await seedPay(ordered, employeeIds, userIds);
  out(`seeded ${SITES.length} sites, ${PEOPLE.length} people with logins and ${PEOPLE.length} pay profiles`);
  return { companyId: company.id, siteIds, employeeIds, userIds, departments };
}

/** A self-contained initials avatar (an inline SVG): the demo has no real photos and loads nothing from outside. */
const TINTS = ['#9FB4FF', '#C7D2FE', '#A7C7E7', '#B8C0CC', '#C3B8E8', '#9CC5C0'];
const avatar = (name: string, n: number): string => {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="${TINTS[n % TINTS.length]}"/><text x="48" y="58" font-family="Arial" font-size="34" font-weight="600" text-anchor="middle" fill="#1B2140">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};
const phone = (n: number): string => `07${String(10000000 + n * 3571).slice(0, 8)}`;

async function seedPay(people: Person[], employees: Map<string, string>, users: Map<string, string>): Promise<void> {
  const hr = users.get('hr')!;
  const accountant = users.get('accountant')!;
  for (const [i, p] of people.entries()) {
    const employeeId = employees.get(p.email)!;
    const amount = String(p.salary);
    const since = date(p.start);
    await prisma.employmentSpell.create({ data: { employeeId, startsOn: since } });
    await prisma.payProfile.create({
      data: { employeeId, amount, overtimeEligible: p.role !== 'DIRECTOR' && p.role !== 'MANAGER', standardWeekHours: '48', standardDayHours: '8', payoutMethod: 'BANK', bankName: p.bank, accountName: p.name, accountNumber: `9999000${String(100 + i)}` } satisfies Prisma.PayProfileUncheckedCreateInput,
    });
    await prisma.payChange.create({ data: { employeeId, amount, effectiveFrom: since, reason: 'Demo starting pay', status: 'APPROVED', requestedById: hr, decidedById: accountant, decidedAt: new Date('2026-01-05T08:00:00Z') } });
  }
}
