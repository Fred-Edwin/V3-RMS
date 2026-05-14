export type OrderStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'READY'
  | 'AWAITING_AUTHORIZATION'
  | 'AWAITING_CANCELLATION_APPROVAL'
  | 'CLOSED'
  | 'CANCELLED';

export type OrderType = 'DINE_IN' | 'TAKE_AWAY' | 'DELIVERY';

export type PaymentMethod =
  | 'MPESA'
  | 'CASH'
  | 'CARD'
  | 'SPLIT'
  | 'GUEST_SPLIT'
  | 'HOUSE_ACCOUNT'
  | 'CORPORATE_ACCOUNT'
  | 'CUSTOMER_CREDIT';

export interface OrderCorrectionListItem {
  id: string;
  dailyNumber: number;
  orderDate: string;
  type: OrderType;
  status: OrderStatus;
  tableNumber: string | null;
  paymentMethod: PaymentMethod | null;
  mpesaCode: string | null;
  total: string;
  createdAt: string;
  closedAt: string | null;
  organizationId: string;
  organizationName: string;
  createdByName: string;
}

export interface OrderCorrectionItemDetail {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  notes: string | null;
}

export interface PrepTicketSummary {
  id: string;
  station: string;
  status: string;
  sequence: number;
}

export interface OrderCorrectionDetail extends OrderCorrectionListItem {
  notes: string | null;
  subtotal: string;
  deliveryFee: string;
  items: OrderCorrectionItemDetail[];
  prepTickets: PrepTicketSummary[];
  pendingAuthRequestId: string | null;
}

export interface OrderCorrectionAuditEntry {
  id: string;
  type: 'ORDER_CORRECTION';
  actor: { id: string; name: string } | null;
  details: {
    action: string;
    field: string;
    before: string;
    after: string;
    reason: string;
    totalBefore?: string;
    totalAfter?: string;
  };
  createdAt: string;
}

export interface OrderCorrectionListResponse {
  orders: OrderCorrectionListItem[];
  pagination: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}

export interface ListOrderCorrectionsQuery {
  branchId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  perPage?: number;
}
