import { z } from 'zod';
import { PrintJobStatus, ReceiptType } from '@prisma/client';

// POST /print-jobs
export const CreatePrintJobSchema = z.object({
  orderId: z.string().uuid('orderId must be a valid UUID'),
  receiptType: z.nativeEnum(ReceiptType).default(ReceiptType.RECEIPT),
  // null / omitted = any station in the branch may claim the job.
  targetStationId: z.string().uuid('targetStationId must be a valid UUID').nullish(),
});

// GET /print-jobs query
export const PrintJobQuerySchema = z.object({
  status: z.nativeEnum(PrintJobStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

// PATCH /print-station/jobs/:id — from Flutter app
export const UpdatePrintJobStatusSchema = z
  .discriminatedUnion('status', [
    z.object({
      status: z.literal(PrintJobStatus.PRINTING),
    }),
    z.object({
      status: z.literal(PrintJobStatus.COMPLETED),
      printedAt: z.string().datetime().optional(),
    }),
    z.object({
      status: z.literal(PrintJobStatus.FAILED),
      failureReason: z.string().min(1).max(500).optional(),
    }),
  ]);

// GET /print-station/jobs query
export const StationJobQuerySchema = z.object({
  status: z.literal(PrintJobStatus.PENDING).optional().default(PrintJobStatus.PENDING),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// POST /print-stations
export const CreatePrintStationSchema = z.object({
  name: z.string().min(1).max(100),
});

// Optional branchId query — DIRECTOR/SYSTEM_ADMIN only, to target another branch
export const BranchIdQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
});

// POST /print-jobs/other-income
export const CreateOtherIncomePrintJobSchema = z.object({
  entryId: z.string().uuid('entryId must be a valid UUID'),
});

// Route param
export const routeIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreatePrintJobInput = z.infer<typeof CreatePrintJobSchema>;
export { ReceiptType };
export type PrintJobQueryInput = z.infer<typeof PrintJobQuerySchema>;
export type UpdatePrintJobStatusInput = z.infer<typeof UpdatePrintJobStatusSchema>;
export type StationJobQueryInput = z.infer<typeof StationJobQuerySchema>;
export type CreatePrintStationInput = z.infer<typeof CreatePrintStationSchema>;
export type CreateOtherIncomePrintJobInput = z.infer<typeof CreateOtherIncomePrintJobSchema>;
