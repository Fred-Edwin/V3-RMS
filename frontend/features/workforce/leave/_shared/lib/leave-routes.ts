/** Leave route paths in one place. Pages in `app/` and links in the screens use these, never string pieces. */
export const MY_LEAVE = '/app/workforce/my-leave';
export const MY_LEAVE_REQUEST = `${MY_LEAVE}/request`;
export const MY_LEAVE_HISTORY = `${MY_LEAVE}/history`;
export const LEAVE_PAGE = '/app/workforce/leave';
export const RULES_LEAVE = '/app/workforce/rules?tab=leave';

export const myLeaveRequestHref = (typeCode?: string, start?: string, end?: string): string => {
  const q = [typeCode ? `type=${encodeURIComponent(typeCode)}` : '', start ? `start=${start}` : '', end ? `end=${end}` : ''].filter(Boolean).join('&');
  return q ? `${MY_LEAVE_REQUEST}?${q}` : MY_LEAVE_REQUEST;
};
export const myLeaveFollowHref = (id: string): string => `${MY_LEAVE_HISTORY}/${id}`;
export const slipHref = (id: string): string => `${MY_LEAVE}/${id}/slip`;
export const requestsHref = (open?: string): string => `${LEAVE_PAGE}?tab=requests${open ? `&open=${open}` : ''}`;
