import { z } from 'zod';
import { isoDateSchema } from './order-schemas';

const reportRoleSchema = z.enum(['WAITER', 'CHEF', 'BARISTA']);

const dateRangeSchema = z
  .object({
    startDate: isoDateSchema,
    endDate: isoDateSchema,
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: 'startDate must be earlier than or equal to endDate',
    path: ['startDate'],
  });

export const DailySummaryQuerySchema = z.object({
  date: isoDateSchema.optional(),
  organizationId: z.string().uuid().optional(),
});

export const StaffPerformanceQuerySchema = dateRangeSchema.extend({
  organizationId: z.string().uuid().optional(),
  role: reportRoleSchema.optional(),
});

export const BranchOverviewQuerySchema = dateRangeSchema;

export const BranchTrendsQuerySchema = dateRangeSchema.extend({
  organizationId: z.string().uuid().optional(),
});

export const DirectorTrendsQuerySchema = dateRangeSchema;

export const MyPerformanceQuerySchema = dateRangeSchema;

export const ExportQuerySchema = dateRangeSchema
  .extend({
    reportType: z.enum(['daily_summary', 'staff_performance', 'branch_overview', 'director_analytics', 'manager_analytics', 'accountant_reconciliation']),
    format: z.enum(['csv', 'pdf']),
    organizationId: z.string().uuid().optional(),
  })
  .refine((value) => value.reportType !== 'daily_summary' || value.startDate === value.endDate, {
    message: 'daily_summary export requires startDate and endDate to be the same date',
    path: ['startDate'],
  });

export const HourlyHeatmapQuerySchema = dateRangeSchema.extend({
  organizationId: z.string().uuid().optional(),
});

export const DirectorPulseQuerySchema = z.object({});

export const DiscountUsageQuerySchema = dateRangeSchema.extend({
  organizationId: z.string().uuid().optional(),
});

export const ItemsPerformanceQuerySchema = dateRangeSchema.extend({
  organizationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export type DirectorPulseQueryInput = z.infer<typeof DirectorPulseQuerySchema>;
export type HourlyHeatmapQueryInput = z.infer<typeof HourlyHeatmapQuerySchema>;
export type ItemsPerformanceQueryInput = z.infer<typeof ItemsPerformanceQuerySchema>;

export const AccountantReconciliationQuerySchema = z.object({
  date: isoDateSchema,
  organizationId: z.string().uuid(),
});

export type DailySummaryQueryInput = z.infer<typeof DailySummaryQuerySchema>;
export type StaffPerformanceQueryInput = z.infer<typeof StaffPerformanceQuerySchema>;
export type BranchOverviewQueryInput = z.infer<typeof BranchOverviewQuerySchema>;
export type BranchTrendsQueryInput = z.infer<typeof BranchTrendsQuerySchema>;
export type DirectorTrendsQueryInput = z.infer<typeof DirectorTrendsQuerySchema>;
export type MyPerformanceQueryInput = z.infer<typeof MyPerformanceQuerySchema>;
export type ExportQueryInput = z.infer<typeof ExportQuerySchema>;
export type AccountantReconciliationQueryInput = z.infer<typeof AccountantReconciliationQuerySchema>;
export type DiscountUsageQueryInput = z.infer<typeof DiscountUsageQuerySchema>;

