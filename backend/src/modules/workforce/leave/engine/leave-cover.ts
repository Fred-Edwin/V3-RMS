import type { NairobiDate } from '../../_shared/time/nairobi-time';

export interface CoverInput {
  days: readonly NairobiDate[];
  /** Rules minimum for the department (site override first); null when none is set. */
  minimum: number | null;
  /** The person asking. They are taken out of the count: it is the team WITHOUT them. */
  employeeId: string;
  /** Active people of the department on the site (used when the rota is not planned for a day). */
  activeIds: readonly string[];
  /** Rostered people per day (the department's rota entries). */
  rostered: ReadonlyMap<NairobiDate, ReadonlySet<string>>;
  /** Days the rota is planned for this department (a rota week with entries). */
  plannedDays: ReadonlySet<NairobiDate>;
  /** Other people on approved leave per day. */
  onLeave: ReadonlyMap<NairobiDate, ReadonlySet<string>>;
  /** People on leave who were kept on the rota with an override reason: they still count as working. */
  keptOnRota: ReadonlyMap<NairobiDate, ReadonlySet<string>>;
}

export interface CoverDay {
  date: NairobiDate;
  planned: boolean;
  minimum: number | null;
  working: number;
  tight: boolean;
}

/**
 * Minimum cover per day (L16). Rota planned: the people rostered that day, minus anyone on approved leave (unless kept with an
 * override), minus the person asking. Not planned: the department's active people minus those on leave minus the person ("usual
 * shifts"). `tight` only warns, it never blocks (L15).
 */
export function coverFor(input: CoverInput): CoverDay[] {
  return input.days.map((date) => {
    const planned = input.plannedDays.has(date);
    const away = input.onLeave.get(date) ?? new Set<string>();
    const kept = input.keptOnRota.get(date) ?? new Set<string>();
    const pool: readonly string[] = planned ? [...(input.rostered.get(date) ?? [])] : input.activeIds;
    const working = pool.filter((id) => id !== input.employeeId && (!away.has(id) || (planned && kept.has(id)))).length;
    return { date, planned, minimum: input.minimum, working, tight: input.minimum !== null && working < input.minimum };
  });
}

/** The single yes or no the person asking sees (no counts, no names). */
export const anyTight = (days: readonly CoverDay[]): boolean => days.some((day) => day.tight);
