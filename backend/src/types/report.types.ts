import type { UserRole } from '@prisma/client';

export interface DailySummaryTopItem {
  menuItemId: string;
  name: string;
  quantitySold: number;
  revenue: string;
}

export interface DailySummaryReport {
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
  };
  topItems: DailySummaryTopItem[];
  averagePrepTimeMinutes: {
    KITCHEN: number;
    BARISTA: number;
  };
}

export interface StaffPerformanceRow {
  id: string;
  name: string;
  role: Extract<UserRole, 'WAITER' | 'CHEF' | 'BARISTA'>;
  ordersHandled: number;
  averageOrderValue: string | null;
  averagePrepTimeMinutes: number | null;
  scheduledHours: number;
  actualHours: number;
}

export interface StaffPerformanceReport {
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
}

export interface BranchOverviewReport {
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

export interface DirectorTrendAggregatePoint {
  date: string;
  totalRevenue: string;
  totalOrders: number;
}

export interface DirectorTrendsReport {
  period: {
    startDate: string;
    endDate: string;
  };
  aggregateSeries: DirectorTrendAggregatePoint[];
  branchRevenueSeries: NamedSeries[];
  branchOrdersSeries: NamedSeries[];
  branchContributionSeries: NamedSeries[];
  itemFamilySeries: NamedSeries[];
  branches: Array<{
    id: string;
    name: string;
  }>;
}

export interface WaiterMyPerformanceReport {
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
}

export interface PrepMyPerformanceReport {
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

export type MyPerformanceReport = WaiterMyPerformanceReport | PrepMyPerformanceReport;

export interface DirectorPulseBranchRow {
  id: string;
  name: string;
  activeOrders: number;
  pendingTickets: number;
  inProgressTickets: number;
  clockedInCount: number;
  clockedInStaff: Array<{ name: string; role: string }>;
}

export interface DirectorPulseReport {
  asOf: string;
  totalActiveOrders: number;
  totalClockedIn: number;
  branches: DirectorPulseBranchRow[];
}

export type ReportType = 'daily_summary' | 'staff_performance' | 'branch_overview';
export type ReportFormat = 'csv' | 'pdf';

