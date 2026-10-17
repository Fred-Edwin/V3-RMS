import type { DepartmentTag, EmploymentStatus, PayType, SiteType, UserRole } from '@prisma/client';
import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { ImpactLine } from '../people-hooks';

/** The shapes the Organisation endpoints return. Dates are Nairobi dates; money is a string. Wire names say `organization`. */

export interface HeadView {
  employeeId: string;
  userId: string | null;
  name: string;
  isActing: boolean;
  since: NairobiDate;
  /** For an acting head: the day the head returns (their last covering day is the day before). */
  returnsOn: NairobiDate | null;
}

export interface DepartmentSummary {
  id: string;
  siteId: string;
  name: string;
  inventoryTag: DepartmentTag | null;
  description: string | null;
  isActive: boolean;
  people: number;
  head: HeadView | null;
  actingHead: HeadView | null;
  /** True when no one heads it today (never true at the Central Store). */
  hasGap: boolean;
}

export interface SiteBlock {
  id: string;
  name: string;
  type: SiteType;
  isHub: boolean;
  /** Heads exist only at branches. */
  headsAllowed: boolean;
  departments: DepartmentSummary[];
  gaps: number;
}

export interface OrgOverview {
  sites: SiteBlock[];
  counts: { sites: number; departments: number; heads: number; gaps: number };
}

export interface DepartmentPerson {
  employeeId: string;
  userId: string | null;
  name: string;
  positionName: string | null;
  status: EmploymentStatus;
  payType: PayType;
  isHead: boolean;
}

export interface CasualPoolPerson extends DepartmentPerson {
  /** The daily rate; present only for a viewer who may read pay. */
  dailyRate?: string | null;
}

export interface DepartmentView extends DepartmentSummary {
  siteName: string;
  isHub: boolean;
  positions: { id: string; name: string; isActive: boolean }[];
  peoplePage: { items: DepartmentPerson[]; page: number; perPage: number; total: number };
  casualPool: { total: number; items: CasualPoolPerson[] };
  /** What the caller may do here; the screen hides the rest. */
  can: { edit: boolean; assignHead: boolean };
}

export interface HeadCandidate {
  employeeId: string;
  userId: string;
  name: string;
  positionName: string | null;
  startDate: NairobiDate;
  isActingHere: boolean;
  recommended: boolean;
}

export interface HeadPreview {
  department: { id: string; name: string; siteId: string };
  employee: { id: string; name: string };
  mode: 'REPLACE' | 'ACTING';
  effectiveOn: NairobiDate;
  returnsOn: NairobiDate | null;
  /** Whose row ends (the current head, or an acting head being replaced); null when nobody is replaced. */
  endsHeadRoleOf: { employeeId: string; name: string; isActing: boolean }[];
  claims: {
    before: { isDepartmentHead: boolean; departmentTag: DepartmentTag | null };
    after: { isDepartmentHead: boolean; departmentTag: DepartmentTag | null };
  };
  /** Machine lines from later slices (approvals that move, shifts); never prose. */
  impacts: ImpactLine[];
  notified: { userId: string; name: string }[];
}

export interface PositionView {
  id: string;
  name: string;
  defaultTracksTime: boolean;
  loginRole: UserRole | null;
  casualsAllowed: boolean;
  isActive: boolean;
  departments: { id: string; name: string; siteId: string }[];
  /** People holding it, whole company; the names below are only those the viewer may see. */
  holderCount: number;
}

export interface PositionDetail extends PositionView {
  holders: { employeeId: string; name: string; siteId: string; departmentId: string | null }[];
}

export interface PositionImpact {
  people: { employeeId: string; name: string }[];
  /** How many people would switch; `acknowledgedPeople` on the PATCH must equal this. */
  count: number;
  impacts: ImpactLine[];
}
