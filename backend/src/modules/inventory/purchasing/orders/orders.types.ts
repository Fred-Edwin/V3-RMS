import type { OrderRowView } from '../_shared/purchasing.types';

export interface OrdersSummary {
  counts: Record<'needs' | 'approval' | 'receive' | 'invoice' | 'pay' | 'closed', number>;
  /** Empty for a caller who may not see item prices. */
  awaitingApprovalValue: string;
  dueToReceiveCount: number;
}

export interface OrdersList {
  orders: OrderRowView[];
  total: number;
  valueTotal: string;
}

/** The printed order. It carries no prices, no total and no amount in words (owner decision, 6 Oct 2026). */
export interface LpoPrint {
  reference: string;
  date: string;
  supplier: { name: string; address: string; contact: string | null; phone: string | null };
  expectedDate: string | null;
  termsLabel: string;
  deliverTo: string;
  raisedByName: string;
  lines: Array<{ n: number; supplierItemName: string; supplierItemCode: string | null; ourItemName: string; qty: string; unit: string }>;
  note: string | null;
  raisedBy: { name: string; role: string; signedAt: string } | null;
  authorisedBy: { name: string; role: string; signedAt: string } | null;
  generatedAt: string;
}

export interface WhatsappMessage {
  to: string;
  phone: string | null;
  message: string;
  pdfFileName: string;
  pdfSizeLabel: string;
}
