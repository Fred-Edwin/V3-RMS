import {
  AlertTriangle,
  Banknote,
  BarChart2,
  Bike,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarOff,
  ChefHat,
  ClipboardList,
  Clock,
  Coffee,
  CreditCard,
  FileText,
  GitBranch,
  House,
  Inbox,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  Network,
  Percent,
  Plane,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShoppingCart,
  SlidersVertical,
  SquareCheckBig,
  Tags,
  Truck,
  UserCircle,
  UserRound,
  Users,
  UtensilsCrossed,
} from 'lucide-react';

import type { AppRole } from '@/types/auth';
import { fromLucide } from '../nav-icons';

/** Roles, role lists, bottom-bar slots and icons the row files share. */

export const MANAGER: AppRole = 'MANAGER';
export const DIRECTOR: AppRole = 'DIRECTOR';
export const ACCOUNTANT: AppRole = 'ACCOUNTANT';
export const SYSTEM_ADMIN: AppRole = 'SYSTEM_ADMIN';
export const HR_MANAGER: AppRole = 'HR_MANAGER';
export const STORE_MANAGER: AppRole = 'STORE_MANAGER';
export const STORE_ATTENDANT: AppRole = 'STORE_ATTENDANT';
export const WAITER: AppRole = 'WAITER';
export const CHEF: AppRole = 'CHEF';
export const BARISTA: AppRole = 'BARISTA';
export const STEWARD: AppRole = 'STEWARD';
export const HOUSEKEEPING: AppRole = 'HOUSEKEEPING';

/** The five desktop roles that read the Central Store from a desktop. */
export const DESKTOP_HUB: readonly AppRole[] = [STORE_MANAGER, ACCOUNTANT, DIRECTOR, MANAGER, SYSTEM_ADMIN];
/** Those, plus the Attendant, who works the Central Store from a phone. */
export const HUB_ALL: readonly AppRole[] = [...DESKTOP_HUB, STORE_ATTENDANT];
export const ALL_HUMAN: readonly AppRole[] = [WAITER, CHEF, BARISTA, MANAGER, DIRECTOR, ACCOUNTANT, HR_MANAGER, SYSTEM_ADMIN, STEWARD, HOUSEKEEPING, STORE_MANAGER, STORE_ATTENDANT];
export const SHIFT_STAFF: readonly AppRole[] = [WAITER, CHEF, BARISTA, STEWARD, HOUSEKEEPING];

// Bottom-bar slots shared by several rows (see `NavRow.quick`). The waiter has no Daily count slot: it stays in the drawer.
export const DAILY_COUNT_SLOT: Partial<Record<AppRole, number>> = { [CHEF]: 2, [BARISTA]: 2, [STEWARD]: 2, [HOUSEKEEPING]: 2 };
export const DELIVERIES_SLOT: Partial<Record<AppRole, number>> = { [WAITER]: 3, [CHEF]: 3, [BARISTA]: 3, [STEWARD]: 3, [HOUSEKEEPING]: 3 };
export const INBOX_SLOT: Partial<Record<AppRole, number>> = { [WAITER]: 4, [CHEF]: 4, [BARISTA]: 4, [STEWARD]: 4, [HOUSEKEEPING]: 4 };

export const ico = {
  dashboard: fromLucide(LayoutDashboard),
  orders: fromLucide(ShoppingCart),
  history: fromLucide(Clock),
  analytics: fromLucide(BarChart2),
  inbox: fromLucide(MessageSquare),
  staff: fromLucide(Users),
  departments: fromLucide(Building2),
  menu: fromLucide(UtensilsCrossed),
  shifts: fromLucide(Calendar),
  delivery: fromLucide(Bike),
  payslips: fromLucide(FileText),
  credit: fromLucide(CreditCard),
  alert: fromLucide(AlertTriangle),
  money: fromLucide(Banknote),
  profile: fromLucide(UserCircle),
  shield: fromLucide(ShieldAlert),
  percent: fromLucide(Percent),
  settings: fromLucide(Settings2),
  tags: fromLucide(Tags),
  chef: fromLucide(ChefHat),
  coffee: fromLucide(Coffee),
  leaveOff: fromLucide(CalendarOff),
  contracts: fromLucide(ScrollText),
  clipboard: fromLucide(ClipboardList),
  branch: fromLucide(GitBranch),
  analyticsLine: fromLucide(LineChart),
  truck: fromLucide(Truck),
  day: fromLucide(CalendarCheck),
  home: fromLucide(House),
  waiting: fromLucide(Inbox),
  timesheets: fromLucide(SquareCheckBig),
  organisation: fromLucide(Network),
  leave: fromLucide(Plane),
  rules: fromLucide(SlidersVertical),
  myTime: fromLucide(Clock),
  me: fromLucide(UserRound),
};

/** The name of each group (a feature, or the caption its links sit under in the menu). Sentence case; the sidebar draws captions in capitals. */
export const NAV_GROUP_LABELS: Readonly<Record<string, string>> = {
  'feature:workforce': 'Workforce',
  'feature:department': 'Department',
  'feature:company': 'Company',
  'mgr-operations': 'Operations',
  'mgr-manage': 'Manage',
  'mgr-credit': 'Credit',
  'mgr-income': 'Other income',
  'mgr-branch': 'Branch',
  'mgr-company': 'Company',
  'dir-branches': 'Branches',
  'dir-income': 'Other income',
  'dir-operations': 'Operations',
  'dir-credit': 'Credit',
  'dir-company': 'Company',
  'acc-financials': 'Financials',
  'acc-credit': 'Credit accounts',
  branches: 'Branches',
  'adm-company': 'Company',
  'staff-nav': 'Work',
  'staff-income': 'Other income',
  'central-store': 'Central Store',
  procurement: 'Procurement',
  department: 'Department',
  account: 'Account',
};
