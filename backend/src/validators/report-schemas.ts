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

export const MyPerformanceQuerySchema = dateRangeSchema;

export const ExportQuerySchema = dateRangeSchema
  .extend({
    reportType: z.enum(['daily_summary', 'staff_performance', 'branch_overview']),
    format: z.enum(['csv', 'pdf']),
    organizationId: z.string().uuid().optional(),
  })
  .refine((value) => value.reportType !== 'daily_summary' || value.startDate === value.endDate, {
    message: 'daily_summary export requires startDate and endDate to be the same date',
    path: ['startDate'],
  });

export type DailySummaryQueryInput = z.infer<typeof DailySummaryQuerySchema>;
export type StaffPerformanceQueryInput = z.infer<typeof StaffPerformanceQuerySchema>;
export type BranchOverviewQueryInput = z.infer<typeof BranchOverviewQuerySchema>;
export type MyPerformanceQueryInput = z.infer<typeof MyPerformanceQuerySchema>;
export type ExportQueryInput = z.infer<typeof ExportQuerySchema>;

