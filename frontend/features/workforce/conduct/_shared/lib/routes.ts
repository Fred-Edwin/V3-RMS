/** Conduct routes (spec section 0). The staff pages sit under /app/conduct, the desks under /app/workforce/conduct. */
export const STAFF_HOME = '/app/conduct';
export const DESK_HOME = '/app/workforce/conduct';

export const staffNoticeHref = (id: string): string => `${STAFF_HOME}/${id}`;
export const signHref = (id: string): string => `${STAFF_HOME}/${id}/sign`;
export const appealHref = (id: string): string => `${STAFF_HOME}/${id}/appeal`;
export const staffDocumentHref = (id: string): string => `${STAFF_HOME}/${id}/document`;

export const deskNoticeHref = (id: string): string => `${DESK_HOME}/${id}`;
export const deskDocumentHref = (id: string): string => `${DESK_HOME}/${id}/document`;
export const deskListHref = (params: Record<string, string | number | undefined> = {}): string => {
  const pairs = Object.entries(params).filter((e): e is [string, string | number] => e[1] !== undefined && e[1] !== '');
  return pairs.length ? `${DESK_HOME}?${pairs.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : DESK_HOME;
};
export const fileConductHref = (employeeId: string): string => `/app/workforce/employees/${employeeId}?tab=conduct`;
