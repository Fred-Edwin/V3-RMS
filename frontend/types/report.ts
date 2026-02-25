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
  role: ReportStaffRole;
  ordersHandled: number;
  averageOrderValue: string | null;
  averagePrepTimeMinutes: number | null;
  scheduledHours: number;
  actualHours: number;
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

