import type { Prisma } from '@prisma/client';
import { resolveClockPairs } from '../../_shared/time/day-hours';
import { toDateColumn, type NairobiDate } from '../../_shared/time/nairobi-time';
import { clockRepository, type NewEvent } from '../clock/clock-repository';
import { inAppendOrder, toFact } from '../days/day-model';
import { daysRepository } from '../days/days-repository';
import { legacyClockRepository } from '../legacy/legacy-clock-repository';

/**
 * How a clock event written under one engine is read by the other, for today (decision A3).
 *  switch ON  : today's finished legacy records become LEGACY events (the unique key makes a second run add nothing).
 *  switch OFF : today's new-engine clocks that belong to a carried legacy assignment become legacy records (insert only).
 */
export interface CarryInResult {
  carried: number;
  skipped: number;
}
export interface MirrorResult {
  mirrored: number;
  /** People who clocked on a shift the legacy tables do not know (the new rota is the only place it exists). */
  notMirrored: string[];
}

/** Legacy clock-ins today that are still open; switching on in the middle of one is refused. */
export async function openLegacyClockIns(siteId: string, today: NairobiDate, db: Prisma.TransactionClient): Promise<number> {
  const records = await legacyClockRepository.recordsOnDate(siteId, toDateColumn(today), db);
  return records.filter((r) => !r.mirrored && r.clockInAt !== null && r.clockOutAt === null).length;
}

export async function carryLegacyIn(tx: Prisma.TransactionClient, siteId: string, today: NairobiDate): Promise<CarryInResult> {
  const records = (await legacyClockRepository.recordsOnDate(siteId, toDateColumn(today), tx)).filter((r) => !r.mirrored && r.clockInAt !== null);
  if (records.length === 0) return { carried: 0, skipped: 0 };

  const entries = await legacyClockRepository.entriesByAssignment(siteId, records.map((r) => r.shiftAssignmentId), tx);
  const byAssignment = new Map(entries.map((e) => [e.legacyAssignmentId as string, e] as const));
  const people = await legacyClockRepository.employeesByUser(siteId, records.filter((r) => !byAssignment.has(r.shiftAssignmentId)).map((r) => r.userId), tx);
  const byUser = new Map(people.map((p) => [p.userId as string, p.id] as const));

  const rows: (NewEvent & { legacyClockRecordId: string })[] = [];
  let skipped = 0;
  for (const record of records) {
    const entry = byAssignment.get(record.shiftAssignmentId);
    const employeeId = entry?.employeeId ?? byUser.get(record.userId);
    if (!employeeId || !record.clockInAt) {
      skipped += 1;
      continue;
    }
    const base = { siteId, employeeId, rotaEntryId: entry?.id ?? null, shiftDate: today, source: 'LEGACY' as const, legacyClockRecordId: record.id };
    rows.push({ ...base, type: 'IN', occurredAt: record.clockInAt });
    if (record.clockOutAt) rows.push({ ...base, type: 'OUT', occurredAt: record.clockOutAt });
  }
  return { carried: await clockRepository.insertCarried(tx, rows), skipped };
}

export async function mirrorBack(tx: Prisma.TransactionClient, siteId: string, today: NairobiDate): Promise<MirrorResult> {
  const data = await daysRepository.loadDayData(siteId, today, today, null, tx);
  const byEntry = new Map<string, typeof data.events>();
  const loose = new Set<string>();
  for (const event of data.events) {
    if (event.rotaEntryId === null) loose.add(event.employeeId);
    else byEntry.set(event.rotaEntryId, [...(byEntry.get(event.rotaEntryId) ?? []), event]);
  }

  const links = await legacyClockRepository.assignmentsForEntries(siteId, [...byEntry.keys()], tx);
  const linkOf = new Map(links.map((l) => [l.id, l] as const));
  const done = await legacyClockRepository.assignmentsWithRecord(siteId, links.map((l) => l.legacyAssignmentId as string), tx);

  let mirrored = 0;
  const notMirrored = new Set<string>(loose);
  for (const [entryId, events] of byEntry) {
    const employeeId = events[0]!.employeeId;
    const link = linkOf.get(entryId);
    const fromLegacy = events.some((e) => e.source === 'LEGACY');
    if (fromLegacy) continue; // the legacy tables already know this one
    const pair = resolveClockPairs(inAppendOrder(events).map(toFact)).pairs[0];
    if (!pair) continue;
    if (!link?.legacyAssignmentId || !link.employee.userId) {
      notMirrored.add(employeeId);
      continue;
    }
    if (done.has(link.legacyAssignmentId)) continue;
    await legacyClockRepository.insertRecord(tx, { siteId, shiftAssignmentId: link.legacyAssignmentId, userId: link.employee.userId, clockInAt: pair.clockIn, clockOutAt: pair.clockOut });
    mirrored += 1;
  }
  return { mirrored, notMirrored: [...notMirrored] };
}
