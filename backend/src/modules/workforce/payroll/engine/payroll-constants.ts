/** Company constants of the payroll checks (P17). A change here is a code change on purpose: they are policy of the product, not of a site. */
export const BIG_CHANGE_PERCENT = 25; // net pay differs from last month by more than this
export const OVERTIME_HIGH_PERCENT = 50; // overtime above this share of basic
export const RETRY_AFTER_SITE_DAYS = 5; // days past month end before the Director may approve a site's timesheets for it (P4)
export const REMINDER_COOLDOWN_HOURS = 24; // a site is reminded at most once in this time (P32)
export const FIRST_MONTH_HAND_CHECKS = 3; // payslips the Accountant checks by hand in the first month of a site (P16)
export const MAX_ADJUSTMENT_AMOUNT = '10000000.00';
