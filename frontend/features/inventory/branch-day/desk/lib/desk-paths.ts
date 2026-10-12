/**
 * Where the Branch day desktop screens live. The Branch Manager's pages are under `/app/branch/day`, the hub roles' under
 * `/app/inventory/branch-day`; the screens are the same, so every link is built from the base the person is on (`useDayBase`).
 */
export type DayBase = '/app/inventory/branch-day' | '/app/branch/day';

export const dayPaths = (base: DayBase) => ({
  today: (branchId?: string): string => (branchId ? `${base}?branch=${branchId}` : base),
  /** A department's figures for a day (Paper B6). */
  figures: (dayId: string, departmentId: string, branchId?: string): string => `${base}/figures?day=${dayId}&dept=${departmentId}${branchId ? `&branch=${branchId}` : ''}`,
  history: `${base}/history`,
  /** The closed day file (Paper B11); `tab` is items, documents or activity. */
  file: (dayId: string, tab?: 'items' | 'documents' | 'activity'): string => `${base}/file/${dayId}${tab ? `?tab=${tab}` : ''}`,
  /** The printed day sheet opens in its own tab. */
  print: (dayId: string, version?: number): string => `${base === '/app/branch/day' ? '/app/branch/day-print' : '/app/inventory/day-print'}/${dayId}${version ? `?version=${version}` : ''}`,
  /** An open discrepancy named in a blocker row. */
  discrepancy: (id: string): string => (base === '/app/branch/day' ? `/app/branch/requisitions/discrepancies/${id}` : `/app/inventory/requisitions/discrepancies/${id}`),
});
