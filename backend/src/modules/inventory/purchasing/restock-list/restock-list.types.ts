/** Wire shapes of "Review and send for approval" (Paper 28C): the restock list grouped by supplier, one order each. */
import type { OrderView, Person } from '../_shared/purchasing.types';

export interface ReviewLine {
  inventoryItemId: string;
  itemName: string;
  /** Whole buy units. */
  qty: string;
  buyUnit: string;
  /** Empty for a caller blind to item prices. Null when the supplier line was never priced. */
  unitPrice: string | null;
  lineTotal: string | null;
}

export type GroupProblem = 'SUPPLIER_ORDER_OPEN' | 'ITEM_SETUP_INCOMPLETE';

export interface ReviewGroup {
  supplier: { id: string; name: string; code: string };
  /** 1, 2, 3: "ORDER 1 · 1 ITEM". */
  orderNumber: number;
  itemCount: number;
  /** Empty for a caller blind to item prices. */
  estimatedTotal: string;
  /** The supplier's open order, when one already holds its slot: this group cannot be sent until it is closed. */
  openOrder: { id: string; reference: string | null } | null;
  /** Why this group would not be sent, null when it can. */
  problem: GroupProblem | null;
  lines: ReviewLine[];
}

export interface RestockReview {
  groups: ReviewGroup[];
  /** Items nobody sells us (or whose only supplier is on hold): they cannot be ordered from the list. */
  unsupplied: Array<{ inventoryItemId: string; itemName: string }>;
  orderCount: number;
  /** Empty for a caller blind to item prices. */
  estimatedTotal: string;
  /** Who approves ("Joseph (Store Manager) approves before anything is ordered"). */
  approver: Person | null;
}

export interface RestockSendResult {
  /** One order per supplier, sent for approval. */
  sent: Array<{ supplier: { id: string; name: string }; order: OrderView }>;
  /** Suppliers whose order could not be made; the others were still sent. `orderId` is set when a draft was saved but not sent. */
  failed: Array<{ supplier: { id: string; name: string }; code: string; message: string; orderId: string | null }>;
  unsupplied: Array<{ inventoryItemId: string; itemName: string }>;
}
