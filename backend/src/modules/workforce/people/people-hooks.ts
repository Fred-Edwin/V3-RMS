import type { NairobiDate } from '../_shared/time/nairobi-time';

export type ImpactKind = 'TRANSFER' | 'EXIT' | 'HEAD_CHANGE' | 'TRACKS_TIME_OFF' | 'LOAN';

export interface ImpactQuery {
  kind: ImpactKind;
  employeeIds: string[];
  siteId: string;
  departmentId: string | null;
  effectiveOn: NairobiDate;
}

/** A machine-readable line. The screen maps `code` to wording from the approved copy table; this is never prose. */
export interface ImpactLine {
  code: string; // for example 'ROTA_SHIFTS_REMOVED', 'APPROVALS_MOVE', 'FINAL_PAY_PENDING'
  count: number | null; // null when the owning slice is not built yet
  detail: Record<string, string | number | null>;
}

export type ImpactProvider = (query: ImpactQuery) => Promise<ImpactLine[]>;

const providers = new Map<string, ImpactProvider>();

/** Later slices register at start-up so previews can say what a change will do to their data. */
export function registerImpactProvider(name: string, provider: ImpactProvider): void {
  providers.set(name, provider);
}

export async function collectImpacts(query: ImpactQuery): Promise<ImpactLine[]> {
  const lines = await Promise.all([...providers.values()].map((provider) => provider(query)));
  return lines.flat();
}

/** Test helper: forget every registered provider. */
export function clearImpactProvidersForTests(): void {
  providers.clear();
}
