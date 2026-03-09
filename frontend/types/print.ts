export type PrintJobStatus = 'PENDING' | 'PRINTING' | 'COMPLETED' | 'FAILED';

export interface PrintJobSummary {
  id: string;
  orderId: string;
  status: PrintJobStatus;
  createdAt: string;
}

export interface PrintJob {
  id: string;
  organizationId: string;
  orderId: string;
  status: PrintJobStatus;
  receiptData: Record<string, unknown>;
  requestedById: string;
  printedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrintStation {
  id: string;
  organizationId: string;
  name: string;
  isActive: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedPrintStation extends PrintStation {
  token: string; // raw token — shown only once on creation
}
