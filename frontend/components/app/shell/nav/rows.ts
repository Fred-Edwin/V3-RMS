import { CENTRAL_STORE_ROWS } from './rows-central-store';
import { DEPARTMENT_ROWS, FLOOR_ROWS } from './rows-floor';
import { OPERATIONS_ROWS } from './rows-operations';
import { WORKFORCE_ROWS } from './rows-workforce';
import type { NavRow } from './types';

/**
 * Every row, in the order each role sees its groups (a group's place is where it first appears). Workforce leads for the roles that have
 * it; the rest follow per module. Add a row to its module's file, never here.
 */
export const NAV_ROWS: readonly NavRow[] = [...WORKFORCE_ROWS, ...OPERATIONS_ROWS, ...FLOOR_ROWS, ...CENTRAL_STORE_ROWS, ...DEPARTMENT_ROWS];

export { WORKFORCE_ROWS };
