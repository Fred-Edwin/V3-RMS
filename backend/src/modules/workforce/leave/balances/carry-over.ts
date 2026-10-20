import { ledgerRepository, type NewEntry } from '../data/ledger-repository';
import type { Db, LeavePerson } from '../data/people-repository';
import { leaveYearOf, yearStart } from '../engine/leave-days';
import type { RulesAt } from '../leave.types';

export interface CarryArgs {
  people: readonly LeavePerson[];
  year: number;
  rulesAtOf: (siteId: string) => RulesAt;
  /** Days left at the end of last year per person and type code (the same balance maths, asked for last year). */
  closingOf: (people: readonly LeavePerson[], previousYear: number) => Promise<Map<string, Map<string, number>>>;
  db: Db;
}

/**
 * Carry-over (L9). The first time a new leave year is read for a person, one `CARRY_OVER` ledger line per type is written:
 * min(days left at the end of last year, `carryOverDays` in force on 1 January). Once only (the ledger's unique index), no expiry.
 * A type with `carryOverDays` 0 writes nothing, so a rules change from 0 to 5 later in the year still carries correctly the first time
 * anyone reads the year after it.
 */
export async function ensureCarryOver(args: CarryArgs): Promise<void> {
  const eligible = args.people.filter((person) => leaveYearOf(person.startDate) < args.year && !person.isCasual);
  if (eligible.length === 0) return;
  const existing = await ledgerRepository.forYear(args.db, eligible.map((person) => person.id), args.year);
  const done = new Set(existing.filter((line) => line.kind === 'CARRY_OVER').map((line) => `${line.employeeId}|${line.typeCode}`));

  const wanted = eligible.flatMap((person) =>
    args
      .rulesAtOf(person.siteId)(yearStart(args.year))
      .leaveTypes.filter((type) => type.carryOverDays > 0 && !done.has(`${person.id}|${type.code}`))
      .map((type) => ({ person, type })),
  );
  if (wanted.length === 0) return;

  const closing = await args.closingOf([...new Set(wanted.map((w) => w.person))], args.year - 1);
  const entries: NewEntry[] = wanted.map(({ person, type }) => ({
    companyId: person.companyId,
    employeeId: person.id,
    typeCode: type.code,
    year: args.year,
    kind: 'CARRY_OVER',
    days: Math.floor(Math.min(Math.max(closing.get(person.id)?.get(type.code) ?? 0, 0), type.carryOverDays)),
    asOf: yearStart(args.year),
    reasonCode: 'CARRY_OVER',
  }));
  await ledgerRepository.addOnce(args.db, entries);
}
