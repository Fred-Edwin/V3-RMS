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

export type ReportType = 'daily_summary' | 'staff_performance' | 'branch_overview';
export type ReportFormat = 'csv' | 'pdf';

