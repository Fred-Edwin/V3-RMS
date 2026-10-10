/** The head's and member's Branch day phone routes (Paper B0 to B4, chapter 5). One place, so no screen spells a path. */
export const DAY_HOME = '/app/day';
export const DAY_OPENING = '/app/day/opening';
export const DAY_RECOUNT = '/app/day/opening/recount';
export const DAY_OPENING_SIGN = '/app/day/opening/sign';
export const DAY_OPENING_RECORDED = '/app/day/opening/recorded';
export const DAY_COUNT = '/app/day/count';
export const DAY_COUNT_CHECK = '/app/day/count/check';
export const DAY_COUNT_FIGURES = '/app/day/count/figures';
export const DAY_SENT = '/app/day/sent';
export const DAY_PAST = '/app/day/history';
export const dayPast = (id: string): string => `${DAY_PAST}/${id}`;
/** The Block 2 delivery count, opened from the Day card "Delivery not counted yet". */
export const DELIVERIES_HOME = '/app/deliveries';
