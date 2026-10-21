import type { ImpactLine } from '../../../_shared/types/people-types';

/**
 * What the Organisation endpoints (O1 to O15) return. Dates are Nairobi `YYYY-MM-DD`. The wire says `organization` where the back end's
 * code says `site` (the wire-names layer), so these types do too.
 */

export interface HeadView {
  employeeId: string;
  userId: string | null;
  name: string;
  isActing: boolean;
  since: string;
  /** For an acting head: the day the head returns. */
  returnsOn: string | null;
}

export interface DepartmentSummary {
  id: string;
  organizationId: string;
  name: string;
  inventoryTag: string | null;
  description: string | null;
  isActive: boolean;
  people: number;
  head: HeadView | null;
  actingHead: HeadView | null;
  hasGap: boolean;
}

export interface SiteBlock {
  id: string;
  name: string;
  type: 'BRANCH' | 'CENTRAL_STORE' | 'HEAD_OFFICE' | string;
  isHub: boolean;
  headsAllowed: boolean;
  departments: DepartmentSummary[];
  gaps: number;
}

export interface OrgOverview {
  organizations: SiteBlock[];
  counts: { organizations: number; departments: number; heads: number; gaps: number };
}

export interface DepartmentPerson {
  employeeId: string;
  userId: string | null;
  name: string;
  positionName: string | null;
  status: string;
  payType: string;
  isHead: boolean;
}

export interface CasualPoolPerson extends DepartmentPerson {
  /** Present only for a viewer who may read pay. */
  dailyRate?: string | null;
}

export interface DepartmentView extends DepartmentSummary {
  organizationName: string;
  isHub: boolean;
  positions: { id: string; name: string; isActive: boolean }[];
  peoplePage: { items: DepartmentPerson[]; page: number; perPage: number; total: number };
  casualPool: { total: number; items: CasualPoolPerson[] };
  can: { edit: boolean; assignHead: boolean };
}

export interface HeadCandidate {
  employeeId: string;
  userId: string;
  name: string;
  positionName: string | null;
  startDate: string;
  isActingHere: boolean;
  recommended: boolean;
}

/** Monthly staff of the department with no login yet (O6b). */
export interface PersonWithoutLogin {
  employeeId: string;
  name: string;
  positionName: string | null;
}

export interface HeadPreview {
  department: { id: string; name: string; organizationId?: string };
  employee: { id: string; name: string };
  mode: 'REPLACE' | 'ACTING';
  effectiveOn: string;
  returnsOn: string | null;
  endsHeadRoleOf: { employeeId: string; name: string; isActing: boolean }[];
  impacts: ImpactLine[];
  notified: { userId: string; name: string }[];
}

export interface PositionView {
  id: string;
  name: string;
  defaultTracksTime: boolean;
  loginRole: string | null;
  casualsAllowed: boolean;
  isActive: boolean;
  departments: { id: string; name: string; organizationId: string }[];
  holderCount: number;
}

export interface PositionDetail extends PositionView {
  holders: { employeeId: string; name: string; organizationId: string; departmentId: string | null }[];
}

export interface PositionImpact {
  people: { employeeId: string; name: string }[];
  count: number;
  impacts: ImpactLine[];
}

// ---- request bodies (the API's `siteId` stays `siteId` on the way in) ---------------------------------
export interface DepartmentCreateBody {
  siteId: string;
  name: string;
  description?: string;
  positionIds: string[];
}
export interface DepartmentUpdateBody {
  name?: string;
  description?: string | null;
  positionIds?: string[];
}
export interface AssignHeadBody {
  employeeId: string;
  mode: 'REPLACE' | 'ACTING';
  returnsOn?: string;
  replaceActing?: boolean;
  reason?: string;
}
export interface EndHeadBody {
  which: 'HEAD' | 'ACTING';
  reason: string;
}
export interface PositionCreateBody {
  name: string;
  defaultTracksTime: boolean;
  loginRole: string | null;
  casualsAllowed: boolean;
  departmentIds: string[];
}
export interface PositionUpdateBody {
  name?: string;
  defaultTracksTime?: boolean;
  loginRole?: string | null;
  casualsAllowed?: boolean;
  departmentIds?: string[];
  acknowledgedPeople?: number;
}
