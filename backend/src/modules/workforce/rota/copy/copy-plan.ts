import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { CellChange } from '../rota.types';

export type ClashKind = 'ON_LEAVE' | 'LOANED_OUT' | 'NOT_EMPLOYED' | 'SHIFT_UNAVAILABLE';

export interface Clash {
  employeeId: string;
  name: string;
  date: NairobiDate;
  kind: ClashKind;
  detail: string | null;
}

export interface CopySourceCell {
  employeeId: string;
  /** The same weekday in the target week. */
  date: NairobiDate;
  templateId: string;
}

export interface CopyFacts {
  source: readonly CopySourceCell[];
  names: ReadonlyMap<string, string>;
  /** Cells already holding a shift in the target week: kept, never overwritten. */
  occupied: ReadonlySet<string>;
  today: NairobiDate;
  /** Why a person cannot work a date, if they cannot. */
  clashOf: (employeeId: string, date: NairobiDate, templateId: string) => { kind: ClashKind; detail: string | null } | null;
}

export interface CopyPlan {
  changes: CellChange[];
  clashes: Clash[];
  shiftsCopied: number;
  people: number;
  kept: number;
  skippedPast: number;
}

const key = (employeeId: string, date: string): string => `${employeeId}|${date}`;

/** What "start from last week" does, worked out without touching the database. Clashes are shown, never copied. */
export function planCopy(facts: CopyFacts): CopyPlan {
  const grouped = new Map<string, CellChange>();
  const clashes: Clash[] = [];
  let kept = 0;
  let skippedPast = 0;
  let shiftsCopied = 0;
  for (const cell of facts.source) {
    if (cell.date < facts.today) {
      skippedPast += 1;
      continue;
    }
    if (facts.occupied.has(key(cell.employeeId, cell.date))) {
      kept += 1;
      continue;
    }
    const clash = facts.clashOf(cell.employeeId, cell.date, cell.templateId);
    if (clash) {
      clashes.push({ employeeId: cell.employeeId, name: facts.names.get(cell.employeeId) ?? cell.employeeId, date: cell.date, ...clash });
      continue;
    }
    const slot = grouped.get(key(cell.employeeId, cell.date)) ?? { employeeId: cell.employeeId, date: cell.date, templateIds: [] };
    slot.templateIds.push(cell.templateId);
    grouped.set(key(cell.employeeId, cell.date), slot);
    shiftsCopied += 1;
  }
  const changes = [...grouped.values()];
  return { changes, clashes, shiftsCopied, people: new Set(changes.map((c) => c.employeeId)).size, kept, skippedPast };
}
