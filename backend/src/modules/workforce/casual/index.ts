/**
 * The public door of Casual pay (Workforce Segment 3). The rest of Workforce imports from here and from nowhere deeper.
 * Payroll's Casual pay tab reads `casualMonthSummary`: the same shape its part 1 tab returns, with the approved sheets filled in.
 */
export { default as workforceCasualRouter } from './casual-routes';
export { monthSummary as casualMonthSummary } from './sheet/sheet-service';
export type { SheetView, LineView, WorkerView, SheetSnapshot } from './casual.types';
