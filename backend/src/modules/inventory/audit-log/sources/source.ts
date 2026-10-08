import type { AuditFilter, Scope } from '../audit-log-repository';
import type { AuditArea, AuditEntry } from '../audit-log.types';

/**
 * One area of the Audit log that is read from rows other features already keep (no event table), like Prep. The service merges
 * every source's entries newest first and cuts the page, so a source only has to return its own newest `take` entries and say
 * how many it has in all. Each source is its own small module in this folder, with its queries in a `-repository.ts` beside it.
 */
export interface AuditSource {
  area: AuditArea;
  /** Its newest `take` entries inside the filter, already worded. */
  entries: (scope: Scope, filter: AuditFilter, take: number) => Promise<AuditEntry[]>;
  /** How many entries it has inside the filter, across all pages. */
  count: (scope: Scope, filter: AuditFilter) => Promise<number>;
  /** People with at least one entry in the period (the "Who" list), whatever the "Who" filter says. */
  actorIds: (scope: Scope, range: Pick<AuditFilter, 'from' | 'to'>) => Promise<string[]>;
}

/** `{ [field]: { gte, lt } }` for the filter's range (`to` is exclusive), or nothing when the range is open. */
export const rangeOn = (field: string, range: Pick<AuditFilter, 'from' | 'to'>): Record<string, { gte?: Date; lt?: Date }> =>
  range.from || range.to ? { [field]: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lt: range.to } : {}) } } : {};

export const PERSON = { select: { id: true, name: true } } as const;
