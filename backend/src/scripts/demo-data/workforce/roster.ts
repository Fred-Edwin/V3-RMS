/**
 * The fictional Wendo for the Workforce demo videos: two branches, the Central Store and 30 made-up people.
 * Nothing here is real: names are invented, bank and ID numbers are obviously fake, emails end in demo.wendo.test.
 */
import type { DepartmentTag, UserRole } from '@prisma/client';

export const DEMO_PASSWORD = 'WendoDemo#2026';
export const DEMO_PIN = '4321';
export const DOMAIN = 'demo.wendo.test';
export const COMPANY_NAME = 'Wendo Coffee Bistro';

export type SiteKey = 'TOWN' | 'HIGHWAY' | 'HUB';

export const SITES: { key: SiteKey; name: string; code: string; hub: boolean; address: string; lat: string; lng: string }[] = [
  { key: 'TOWN', name: 'Nyeri Town', code: 'NYT', hub: false, address: 'Kimathi Way, Nyeri', lat: '-0.4201000', lng: '36.9475000' },
  { key: 'HIGHWAY', name: 'Nyeri Highway', code: 'NYH', hub: false, address: 'Nyeri-Nanyuki Road, Nyeri', lat: '-0.3920000', lng: '36.9720000' },
  { key: 'HUB', name: 'Central Store', code: 'CST', hub: true, address: 'Industrial Area, Nyeri', lat: '-0.4300000', lng: '36.9400000' },
];

export interface Person {
  email: string; // before the @
  name: string;
  site: SiteKey;
  role: UserRole;
  position: string;
  dept?: DepartmentTag; // the branch department; floor staff only
  head?: boolean; // heads the department
  salary: number; // monthly, KES
  start: string; // YYYY-MM-DD
  bank: string;
}

const P = (email: string, name: string, site: SiteKey, role: UserRole, position: string, salary: number, start: string, bank: string, dept?: DepartmentTag, head = false): Person =>
  ({ email, name, site, role, position, salary, start, bank, ...(dept ? { dept } : {}), head });

export const PEOPLE: Person[] = [
  // Office (Central Store site): the desktop roles that are also on the payroll
  P('hr', 'Mercy Akinyi', 'HUB', 'HR_MANAGER', 'HR Manager', 85000, '2024-02-01', 'Equity Bank'),
  P('accountant', 'Anne Muthoni', 'HUB', 'ACCOUNTANT', 'Accountant', 95000, '2024-02-01', 'KCB'),
  P('director', 'Charles Ndungu', 'HUB', 'DIRECTOR', 'Director', 180000, '2023-06-01', 'Co-operative Bank'),
  P('store.manager', 'Lucy Wangari', 'HUB', 'STORE_MANAGER', 'Store Manager', 70000, '2024-05-01', 'Family Bank'),
  P('kevin.mutua', 'Kevin Mutua', 'HUB', 'STORE_ATTENDANT', 'Store Attendant', 32000, '2025-03-10', 'Equity Bank'),
  // Nyeri Town
  P('bm.town', 'Faith Wambui', 'TOWN', 'MANAGER', 'Branch Manager', 78000, '2024-03-01', 'KCB'),
  P('kelvin.mwai', 'Kelvin Mwai', 'TOWN', 'CHEF', 'Chef', 52000, '2024-04-01', 'Equity Bank', 'KITCHEN', true),
  P('peter.kamau', 'Peter Kamau', 'TOWN', 'CHEF', 'Chef', 38000, '2025-01-06', 'KCB', 'KITCHEN'),
  P('mary.njeri', 'Mary Njeri', 'TOWN', 'CHEF', 'Chef', 36000, '2025-06-02', 'Family Bank', 'KITCHEN'),
  P('joseph.maina', 'Joseph Maina', 'TOWN', 'CHEF', 'Chef', 40000, '2024-09-02', 'Equity Bank', 'PASTRY', true),
  P('victor.mutua', 'Victor Mutua', 'TOWN', 'BARISTA', 'Barista', 44000, '2024-04-01', 'Co-operative Bank', 'BARISTA', true),
  P('cynthia.muthoni', 'Cynthia Muthoni', 'TOWN', 'BARISTA', 'Barista', 32000, '2025-02-03', 'Equity Bank', 'BARISTA'),
  P('brian.kiprop', 'Brian Kiprop', 'TOWN', 'BARISTA', 'Barista', 30000, '2025-08-04', 'KCB', 'BARISTA'),
  P('susan.wafula', 'Susan Wafula', 'TOWN', 'WAITER', 'Waiter', 36000, '2024-05-06', 'Family Bank', 'SERVICE', true),
  P('naomi.jepkorir', 'Naomi Jepkorir', 'TOWN', 'WAITER', 'Waiter', 26000, '2025-04-07', 'Equity Bank', 'SERVICE'),
  P('paul.odhiambo', 'Paul Odhiambo', 'TOWN', 'WAITER', 'Waiter', 26000, '2025-09-01', 'KCB', 'SERVICE'),
  P('isaac.kimani', 'Isaac Kimani', 'TOWN', 'WAITER', 'Waiter', 25000, '2026-01-12', 'Co-operative Bank', 'SERVICE'),
  P('daniel.gitau', 'Daniel Gitau', 'TOWN', 'STEWARD', 'Steward', 24000, '2025-05-05', 'Equity Bank', 'KITCHEN'),
  // Nyeri Highway
  P('bm.highway', 'James Karanja', 'HIGHWAY', 'MANAGER', 'Branch Manager', 74000, '2024-08-01', 'Equity Bank'),
  P('esther.wambui', 'Esther Wambui', 'HIGHWAY', 'CHEF', 'Chef', 50000, '2024-08-05', 'KCB', 'KITCHEN', true),
  P('samuel.kariuki', 'Samuel Kariuki', 'HIGHWAY', 'CHEF', 'Chef', 37000, '2025-02-03', 'Family Bank', 'KITCHEN'),
  P('faith.chebet', 'Faith Chebet', 'HIGHWAY', 'BARISTA', 'Barista', 42000, '2024-08-05', 'Equity Bank', 'BARISTA', true),
  P('dennis.otieno', 'Dennis Otieno', 'HIGHWAY', 'BARISTA', 'Barista', 30000, '2025-07-07', 'Co-operative Bank', 'BARISTA'),
  P('beatrice.atieno', 'Beatrice Atieno', 'HIGHWAY', 'WAITER', 'Waiter', 34000, '2024-08-05', 'KCB', 'SERVICE', true),
  P('victor.njoroge', 'Victor Njoroge', 'HIGHWAY', 'WAITER', 'Waiter', 25000, '2025-10-06', 'Equity Bank', 'SERVICE'),
  P('joy.chepkoech', 'Joy Chepkoech', 'HIGHWAY', 'WAITER', 'Waiter', 25000, '2026-09-14', 'Family Bank', 'SERVICE'), // joined mid-September
];

export const ADMIN = { email: 'admin', name: 'Alex Njoroge', role: 'SYSTEM_ADMIN' as UserRole };

export const emailOf = (local: string): string => `${local}@${DOMAIN}`;

/** The table the README prints. */
export const LOGIN_ROWS: { who: string; email: string; role: string }[] = [
  { who: ADMIN.name, email: emailOf(ADMIN.email), role: 'System Admin' },
  ...PEOPLE.map((p) => ({ who: p.name, email: emailOf(p.email), role: p.position + (p.head ? ' (department head)' : '') })),
];
