/** The head's phone routes. The route gate already lets a department head into `/app/requisitions`. */
export const REQ_HOME = '/app/requisitions';
export const REQ_HISTORY = '/app/requisitions/history';
export const reqFile = (id: string): string => `${REQ_HOME}/${id}`;
export const reqEdit = (id: string): string => `${REQ_HOME}/${id}/edit`;
export const reqEditAdd = (id: string): string => `${REQ_HOME}/${id}/edit?add=1`;
export const reqAddMore = (id: string): string => `${REQ_HOME}/${id}/add`;
