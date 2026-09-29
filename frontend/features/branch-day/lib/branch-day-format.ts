import type { CloseBlocker, DepartmentDaySummary, DepartmentDayStatus, DepartmentLine, GapReasonValue } from '../types/branch-day';

/** Branch day reasons (plan §1.8) — the option set handed to the shared reason control. */
export const GAP_REASON_OPTIONS: { value: GapReasonValue; label: string }[] = [
  { value: 'CONSUMPTION', label: 'Consumption' },
  { value: 'UNLOGGED_WASTE', label: 'Unlogged waste' },
  { value: 'WALK_IN_COMP', label: 'Walk-in comp' },
  { value: 'SUSPECTED_LOSS', label: 'Suspected loss' },
  { value: 'OTHER', label: 'Other (describe)' },
];

export const GAP_REASON_LABEL: Record<GapReasonValue, string> = Object.fromEntries(GAP_REASON_OPTIONS.map((o) => [o.value, o.label])) as Record<GapReasonValue, string>;

/* --------------------------------------------------------------- numbers */

/** Keep only what a count figure can be while typing: digits and one decimal point. */
export function sanitizeCountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  return dot === -1 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
}

/** "" / "." → not counted; ".5" → "0.5"; "12." → "12". */
export function normalizeCount(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '.') return null;
  const n = trimmed.startsWith('.') ? `0${trimmed}` : trimmed;
  return n.endsWith('.') ? n.slice(0, -1) : n;
}

/** A trimmed display figure: 18, 0.5, 12.25 — never 18.0000. */
export function trimQty(value: string | number): string {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(n)) return '—';
  return String(Number(n.toFixed(3)));
}

export interface LiveGap {
  /** counted − expected; null until a figure is typed. */
  gap: number | null;
  /** gap × unit cost in KES, signed. */
  value: number | null;
  /** True when the gap is non-zero and its KES value reaches the branch threshold. */
  reasonRequired: boolean;
}

/** The gap recomputed from what is typed, so the row reacts before the save round-trips (server stays authoritative). */
export function liveGap(line: Pick<DepartmentLine, 'expectedQty' | 'unitCost'>, counted: string | null, thresholdKes: number): LiveGap {
  if (counted === null) return { gap: null, value: null, reasonRequired: false };
  const gap = Number((Number.parseFloat(counted) - Number.parseFloat(line.expectedQty)).toFixed(4));
  const value = gap * Number.parseFloat(line.unitCost);
  return { gap, value, reasonRequired: gap !== 0 && Math.abs(value) >= thresholdKes };
}

/** "−5 pcs" / "+2 kg". */
export function formatGap(gap: number, unit: string): string {
  const sign = gap < 0 ? '−' : '+';
  return `${sign}${trimQty(Math.abs(gap))} ${unit}`.trim();
}

/** "−KES 1,940" / "KES 0". */
export function formatNetKes(value: string | number): string {
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  const abs = Math.round(Math.abs(n)).toLocaleString('en-US');
  if (Math.round(n) === 0) return 'KES 0';
  return `${n < 0 ? '−' : '+'}KES ${abs}`;
}

/* --------------------------------------------------------------- statuses */

export type StatusTone = 'success' | 'warning' | 'error' | 'neutral';

export const DEPARTMENT_STATUS_COPY: Record<DepartmentDayStatus, { label: string; tone: StatusTone }> = {
  NOT_STARTED: { label: 'not started', tone: 'warning' },
  COUNTING: { label: 'counting', tone: 'warning' },
  COUNTED: { label: 'counted', tone: 'success' },
  BLOCKED: { label: 'blocked', tone: 'error' },
  CLOSED: { label: 'closed', tone: 'success' },
};

export const TONE_TEXT: Record<StatusTone, string> = {
  success: 'text-wds-success-fg',
  warning: 'text-wds-warning-fg',
  error: 'text-wds-error-fg',
  neutral: 'text-wds-text-copy-muted',
};

export const TONE_DOT: Record<StatusTone, string> = {
  success: 'bg-wds-success-fg',
  warning: 'bg-wds-warning-fg',
  error: 'bg-wds-error-fg',
  neutral: 'bg-wds-neutral-400',
};

/** "Dispatch 2 · Nyeri Town · 22 Sept" → "dispatch 2". */
export function dispatchShort(sequenceLabel: string): string {
  return (sequenceLabel.split(' · ')[0] ?? sequenceLabel).toLowerCase();
}

/** The rail's second line (`19C8-0`): who counted, how many items, when — or why it can't be. */
export function railDetail(d: DepartmentDaySummary, clock: (iso: string) => string, short: (name: string) => string): string {
  if (d.status === 'BLOCKED') {
    const labels = d.blockingDispatches.map((x) => dispatchShort(x.sequenceLabel)).join(', ');
    return `${labels} unconfirmed`;
  }
  const by = d.countedBy ? `${short(d.countedBy.name)} · ` : '';
  if (d.status === 'COUNTING') return `${by}${d.countedLines} of ${d.itemCount} counted`;
  if (d.status === 'NOT_STARTED') return 'Count not yet begun';
  const noun = d.itemCount === 1 ? 'item' : 'items';
  return `${by}${d.itemCount} ${noun}${d.countedAt ? ` · ${clock(d.countedAt)}` : ''}`;
}

/**
 * The warning line above the disabled "Sign & close day" (`19C8-0`): blocked
 * first, then still-counting, then untouched departments grouped so five
 * departments never produce five sentences — "Kitchen is still counting ·
 * Barista is blocked · Pastry, Service aren't counted yet."
 */
export function blockerSummary(blockers: CloseBlocker[], departments: DepartmentDaySummary[]): string {
  const nameOf = (tag: string): string => departments.find((d) => d.tag === tag)?.name ?? tag;
  const blocked = blockers.filter((b) => b.code === 'BLOCKED').map((b) => nameOf(b.departmentTag));
  const counting = blockers
    .filter((b) => b.code === 'NOT_COUNTED' && departments.find((d) => d.tag === b.departmentTag)?.status === 'COUNTING')
    .map((b) => nameOf(b.departmentTag));
  const untouched = blockers
    .filter((b) => b.code === 'NOT_COUNTED' && departments.find((d) => d.tag === b.departmentTag)?.status !== 'COUNTING')
    .map((b) => nameOf(b.departmentTag));
  const reasons = blockers.filter((b) => b.code === 'REASON_REQUIRED').map((b) => nameOf(b.departmentTag));

  const list = (names: string[]): string => names.join(', ');
  const parts: string[] = [];
  if (counting.length) parts.push(`${list(counting)} ${counting.length === 1 ? 'is' : 'are'} still counting`);
  if (blocked.length) parts.push(`${list(blocked)} ${blocked.length === 1 ? 'is' : 'are'} blocked`);
  if (untouched.length) parts.push(`${list(untouched)} ${untouched.length === 1 ? "isn't" : "aren't"} counted yet`);
  if (reasons.length) parts.push(`${list(reasons)} ${reasons.length === 1 ? 'has a gap' : 'have gaps'} without a reason`);
  return parts.length ? `${parts.join(' · ')}.` : '';
}
