import type { AppRole } from './auth';

export type ReportStaffRole = Extract<AppRole, 'WAITER' | 'CHEF' | 'BARISTA'>;

export interface DailySummaryTopItem {
  menuItemId: string;
  name: string;
  quantitySold: number;
  revenue: string;
}

export interface DailySummary {
  date: string;
  organizationId: string;
  organizationName: string;
  totalRevenue: string;
  orderCount: number;
  ordersByType: {
    DINE_IN: number;
    TAKE_AWAY: number;
    DELIVERY: number;
  };
  revenueByPaymentMethod: {
    MPESA: string;
    CASH: string;
    CARD: string;
    SPLIT: string;
    HOUSE_ACCOUNT: string;
    CORPORATE_ACCOUNT: string;
    CUSTOMER_CREDIT: string;
  };
  topItems: DailySummaryTopItem[];
  averagePrepTimeMinutes: {
    KITCHEN: number;
    BARISTA: number;
  };
}

export interface WaiterPaymentBreakdown {
  mpesa: string;
  cash: string;
  card: string;
  houseAccount: string;
  corporateAccount: string;
  customerCredit: string;
  total: string;
}

export interface StaffPerformanceRow {
  id: string;
  name: string;
  role: ReportStaffRole;
  ordersHandled: number;
  averageOrderValue: string | null;
  averagePrepTimeMinutes: number | null;
  scheduledHours: number;
  actualHours: number;
  paymentBreakdown: WaiterPaymentBreakdown | null;
}

export interface StaffPerformancePeriod {
  period: {
    startDate: string;
    endDate: string;
  };
  organizationId: string;
  organizationName: string;
  staff: StaffPerformanceRow[];
}

export interface BranchOverviewRow {
  id: string;
  name: string;
  revenue: string;
  orderCount: number;
  averagePrepTimeMinutes: {
    KITCHEN: number;
    BARISTA: number;
  };
  paymentBreakdown: WaiterPaymentBreakdown;
}

export interface AccountantReconciliationOrder {
  id: string;
  dailyNumber: number;
  time: string;
  waiterName: string;
  total: string;
  paymentMethod: string;
  mpesaCode: string | null;
  mpesaAmount: string | null;
  cashAmount: string | null;
  cardAmount: string | null;
  splitType: string | null;
}

export interface AccountantReconciliationWaiterRow {
  id: string;
  name: string;
  ordersHandled: number;
  paymentBreakdown: WaiterPaymentBreakdown;
}

export interface AccountantReconciliationReport {
  date: string;
  organizationId: string;
  organizationName: string;
  summary: WaiterPaymentBreakdown;
  waiters: AccountantReconciliationWaiterRow[];
  orders: AccountantReconciliationOrder[];
}

export interface BranchOverview {
  period: {
    startDate: string;
    endDate: string;
  };
  totalRevenue: string;
  totalOrders: number;
  branches: BranchOverviewRow[];
}

export interface BranchTrendPoint {
  date: string;
  orders: number;
  revenue: string;
  avgPrepKitchen: number;
  avgPrepBarista: number;
  avgPrepCombined: number;
}

export interface BranchTrendsReport {
  period: {
    startDate: string;
    endDate: string;
  };
  organizationId: string;
  organizationName: string;
  points: BranchTrendPoint[];
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface NamedSeries {
  id: string;
  name: string;
  points: SeriesPoint[];
}

export interface DirectorAggregateTrendPoint {
  date: string;
  totalRevenue: string;
  totalOrders: number;
}

export interface DirectorTrendsReport {
  period: {
    startDate: string;
    endDate: string;
  };
  aggregateSeries: DirectorAggregateTrendPoint[];
  branchRevenueSeries: NamedSeries[];
  branchOrdersSeries: NamedSeries[];
  branchContributionSeries: NamedSeries[];
  itemFamilySeries: NamedSeries[];
  branches: Array<{
    id: string;
    name: string;
  }>;
}

export interface WaiterPerformance {
  role: 'WAITER';
  period: {
    startDate: string;
    endDate: string;
  };
  ordersHandled: number;
  averageOrderValue: string;
  totalRevenueGenerated: string;
  busiestDay: string | null;
  ordersOverTime: Array<{
    date: string;
    count: number;
  }>;
  topItems: Array<{
    name: string;
    quantitySold: number;
  }>;
  paymentBreakdown: WaiterPaymentBreakdown;
}

export interface PrepPerformance {
  role: 'CHEF' | 'BARISTA';
  period: {
    startDate: string;
    endDate: string;
  };
  ticketsCompleted: number;
  averagePrepTimeMinutes: number;
  fastestPrepTimeMinutes: number;
  busiestDay: string | null;
  ordersOverTime: Array<{
    date: string;
    count: number;
  }>;
}

export type MyPerformance = WaiterPerformance | PrepPerformance;

export interface DirectorPulseLateOrder {
  id: string;
  dailyNumber: number;
  total: string;
  ageMinutes: number;
  waiterName: string;
}

export interface DirectorPulseBranchRow {
  id: string;
  name: string;
  activeOrders: number;
  pendingTickets: number;
  inProgressTickets: number;
  clockedInCount: number;
  clockedInStaff: Array<{ name: string; role: string }>;
  lateOrderCount: number;
  lateOrders: DirectorPulseLateOrder[];
}

export interface DirectorPulseReport {
  asOf: string;
  totalActiveOrders: number;
  totalClockedIn: number;
  branches: DirectorPulseBranchRow[];
}

export interface OutstandingHouseAccountRow {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  currentBalance: string;
  creditLimit: string | null;
}

export interface OutstandingCorporateAccountRow {
  id: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  currentBalance: string;
  creditLimit: string | null;
}

export interface OutstandingCustomerCreditRow {
  id: string;
  organizationId: string;
  organizationName: string;
  customerName: string;
  customerPhone: string;
  currentBalance: string;
  creditLimit: string;
}

export interface OutstandingBalancesReport {
  houseAccounts: OutstandingHouseAccountRow[];
  corporateAccounts: OutstandingCorporateAccountRow[];
  customerCreditAccounts: OutstandingCustomerCreditRow[];
  totals: {
    houseAccounts: string;
    corporateAccounts: string;
    customerCreditAccounts: string;
    grandTotal: string;
  };
}

export interface HourlyHeatmapPoint {
  hour: number;
  label: string;
  orderCount: number;
  byType: {
    DINE_IN: number;
    TAKE_AWAY: number;
    DELIVERY: number;
  };
}

export interface DowHeatmapPoint {
  dow: number;
  label: string;
  avgOrderCount: number;
}

export interface HourlyHeatmapReport {
  period: {
    startDate: string;
    endDate: string;
  };
  organizationId: string;
  organizationName: string;
  hourlyPoints: HourlyHeatmapPoint[];
  dowPoints: DowHeatmapPoint[];
}

export interface ItemPerformanceRow {
  menuItemId: string;
  name: string;
  categoryName: string;
  quantitySold: number;
  revenue: string;
}

export interface ItemsPerformanceReport {
  period: {
    startDate: string;
    endDate: string;
  };
  organizationId: string;
  organizationName: string;
  topItems: ItemPerformanceRow[];
  bottomItems: ItemPerformanceRow[];
  limit: number;
}

export interface ItemsPerformanceQuery {
  startDate: string;
  endDate: string;
  organizationId?: string;
  limit?: number;
}

export interface HourlyHeatmapQuery {
  startDate: string;
  endDate: string;
  organizationId?: string;
}

export interface StaffPerformanceQuery {
  startDate: string;
  endDate: string;
  organizationId?: string;
  role?: ReportStaffRole;
}

export interface BranchOverviewQuery {
  startDate: string;
  endDate: string;
}

export interface BranchTrendsQuery {
  startDate: string;
  endDate: string;
  organizationId?: string;
}

export interface DirectorTrendsQuery {
  startDate: string;
  endDate: string;
}

export interface MyPerformanceQuery {
  startDate: string;
  endDate: string;
}

export interface ExportReportQuery {
  reportType: 'daily_summary' | 'staff_performance' | 'branch_overview';
  format: 'csv' | 'pdf';
  startDate: string;
  endDate: string;
  organizationId?: string;
}

export interface AccountantReconciliationQuery {
  date: string;
  organizationId: string;
}

