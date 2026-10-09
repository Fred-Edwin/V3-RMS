/** The department's phone routes. The route gate lets heads and floor staff into `/app/deliveries`; the API decides which department a person may count. */
export const DELIVERIES_HOME = '/app/deliveries';
export const deliveryCount = (id: string): string => `${DELIVERIES_HOME}/${id}/count`;
export const deliveryConfirm = (id: string): string => `${DELIVERIES_HOME}/${id}/confirm`;
export const deliveryDone = (id: string): string => `${DELIVERIES_HOME}/${id}/done`;
export const deliveryFile = (id: string): string => `${DELIVERIES_HOME}/${id}`;
/** G2: the Deliveries tab of History. */
export const DELIVERIES_HISTORY = '/app/requisitions/history?tab=deliveries';
export const MEMBER_HISTORY = '/app/deliveries/history';
