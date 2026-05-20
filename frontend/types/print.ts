export type PrintJobStatus = 'PENDING' | 'PRINTING' | 'COMPLETED' | 'FAILED';
export type ReceiptType = 'BILL' | 'RECEIPT';

export interface PrintJobSummary {
  id: string;
  orderId: string;
  receiptType: ReceiptType;
  copies: number;
  status: PrintJobStatus;
  targetStationId: string | null;
  createdAt: string;
}

/** Lightweight station shape returned by GET /print-stations/selectable. */
export interface SelectablePrintStation {
  id: string;
  name: string;
  isOnline: boolean;
}

export interface PrintJob {
  id: string;
  organizationId: string;
  orderId: string;
  activeKey: string | null;
  receiptType: ReceiptType;
  copies: number;
  status: PrintJobStatus;
  receiptData: Record<string, unknown>;
  requestedById: string;
  claimedByStationId: string | null;
  claimedAt: string | null;
  leaseExpiresAt: string | null;
  printAttemptCount: number;
  printedByStationId: string | null;
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
