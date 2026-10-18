import type { CellChange } from '../rota.types';

export interface PlanEntry {
  id: string;
  employeeId: string;
  date: string;
  templateId: string;
}

export interface CellPlan {
  add: { employeeId: string; date: string; templateId: string }[];
  remove: PlanEntry[];
  /** The cells that really change (a cell set to what it already is drops out). */
  changed: { employeeId: string; date: string; from: string[]; to: string[] }[];
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x) => b.includes(x));

/** What must be written to make each asked cell look as requested. A later change to the same cell wins. */
export function planCells(wanted: readonly CellChange[], existing: readonly PlanEntry[]): CellPlan {
  const last = new Map<string, CellChange>();
  for (const change of wanted) last.set(`${change.employeeId}|${change.date}`, change);
  const plan: CellPlan = { add: [], remove: [], changed: [] };
  for (const change of last.values()) {
    const current = existing.filter((e) => e.employeeId === change.employeeId && e.date === change.date);
    const from = current.map((e) => e.templateId);
    if (sameSet(from, change.templateIds)) continue;
    plan.remove.push(...current.filter((e) => !change.templateIds.includes(e.templateId)));
    for (const templateId of change.templateIds) if (!from.includes(templateId)) plan.add.push({ employeeId: change.employeeId, date: change.date, templateId });
    plan.changed.push({ employeeId: change.employeeId, date: change.date, from, to: [...change.templateIds] });
  }
  return plan;
}
