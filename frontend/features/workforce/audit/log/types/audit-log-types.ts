/** The answers of `GET /workforce/audit/*` (API_CONTRACT §46). Names match the wire exactly. */

export type AuditEventCode = 'people' | 'time' | 'leave' | 'pay' | 'rules' | 'payslips' | 'documents' | 'conduct' | 'security';
export type AuditArea = 'WORKFORCE' | 'ACCESS';
export type AuditSort = 'newest' | 'oldest';

export interface AuditRow {
  id: string;
  seq: string;
  occurredAt: string;
  actor: { id: string | null; name: string; role: string };
  channel: string;
  area: string;
  event: AuditEventCode;
  action: string;
  title: string;
  detail: string;
  subject: { type: string; id: string; label: string };
  subjectUser: { id: string; name: string } | null;
  /** The API still says "organization" for a site (wire names). */
  organizationId: string | null;
  organizationName: string | null;
  flagged: boolean;
  reason: string | null;
  deviceLabel: string | null;
  placeLabel: string | null;
}

export interface AuditFacets {
  areas: string[];
  events: { code: string; label: string }[];
  organizations: { id: string; name: string }[];
}

export interface AuditPage {
  entries: AuditRow[];
  total: number;
  /** False above 50,000: say "more than 50,000". */
  totalIsExact: boolean;
  page: number;
  pageSize: number;
  range: { from: string; to: string; reachesArchive: boolean };
  facets: AuditFacets;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface AuditDetail extends AuditRow {
  before: JsonValue | null;
  after: JsonValue | null;
  hash: string;
  prevHash: string;
  signature: 'PIN' | null;
}

export interface ChainCheck {
  ok: boolean;
  checked: number;
  fromSeq: string;
  toSeq: string;
  firstBadSeq?: string;
  problem?: string;
}

export interface AuditViewer {
  userId: string;
  name: string;
  role: string;
  lastAt: string;
}

/** Everything the screen can ask the list for; the URL holds exactly these. */
export interface AuditQuery {
  q: string;
  area: AuditArea | '';
  event: AuditEventCode | 'all';
  siteId: string;
  actorId: string;
  subjectUserId: string;
  flagged: boolean;
  from: string;
  to: string;
  sort: AuditSort;
  page: number;
  pageSize: 25 | 50 | 100;
}
