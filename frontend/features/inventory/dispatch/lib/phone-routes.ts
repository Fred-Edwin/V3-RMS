/** The Attendant's phone routes (Dispatch row of the nav table). The route gate already lets the Store Attendant into `/app/inventory`. */
export const DISPATCH_HOME = '/app/inventory/dispatch';
export const dispatchTab = (tab: 'to-pack' | 'on-the-way' | 'done'): string => (tab === 'to-pack' ? DISPATCH_HOME : `${DISPATCH_HOME}?tab=${tab}`);
export const packOverview = (requisitionId: string): string => `${DISPATCH_HOME}/pack/${requisitionId}`;
export const packDepartment = (requisitionId: string, departmentId: string): string => `${DISPATCH_HOME}/pack/${requisitionId}/${departmentId}`;
export const packReview = (requisitionId: string): string => `${DISPATCH_HOME}/pack/${requisitionId}/review`;
export const packReviewLines = (requisitionId: string): string => `${DISPATCH_HOME}/pack/${requisitionId}/review/lines`;
export const packSent = (requisitionId: string): string => `${DISPATCH_HOME}/pack/${requisitionId}/sent`;
export const dispatchFile = (id: string): string => `${DISPATCH_HOME}/${id}`;
/** The printed delivery notes of the dispatches just sent (every department's store copy, then its branch copy). */
export const dispatchPrintBatch = (ids: readonly string[]): string => `/app/inventory/dispatch-print/batch?ids=${ids.join(',')}`;
