// Stale-order waiter liability — visibility for waiters + HR payroll rollup.
// Mirrors backend src/types/report.types.ts.

export interface WaiterLiabilityOrder {
  id: string;
  dailyNumber: number;
  status: string;
  orderDate: string;
  tableNumber: string | null;
  total: string;
  branchName: string;
}

/** A waiter's own unresolved stale-order liability list + running total. */
export interface MyWaiterLiabilityReport {
  totalOrders: number;
  totalLiability: string;
  orders: WaiterLiabilityOrder[];
}

export interface WaiterLiabilitySummaryRow {
  waiterId: string;
  waiterName: string;
  branchName: string;
  orderCount: number;
  totalLiability: string;
  orders: WaiterLiabilityOrder[];
}

/** HR/payroll view: per-waiter rollup across selected branches. */
export interface WaiterLiabilitySummaryReport {
  totalWaiters: number;
  totalOrders: number;
  totalLiability: string;
  waiters: WaiterLiabilitySummaryRow[];
}
