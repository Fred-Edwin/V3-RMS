export type OrderType = 'DINE_IN' | 'TAKE_AWAY' | 'DELIVERY';
export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'CLOSED' | 'CANCELLED';
export type PaymentMethod = 'MPESA' | 'CASH' | 'CARD' | 'SPLIT';
export type PrepStation = 'KITCHEN' | 'BARISTA';
export type PrepTicketStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'REJECTED';
export type OrderListView = 'full' | 'summary';

export interface PrepTicketSummary {
  id: string;
  orderId: string;
  station: PrepStation;
  status: PrepTicketStatus;
  claimedBy: { id: string; name: string } | null;
  claimedAt: string | null;
  readyAt: string | null;
  rejectedReason?: string | null;
}

export interface OrderSummary {
  id: string;
  dailyNumber: number;
  orderDate: string;
  type: OrderType;
  status: OrderStatus;
  tableNumber: string | null;
  notes: string | null;
  subtotal: string;
  deliveryFee: string;
  total: string;
  paymentMethod: PaymentMethod | null;
  mpesaCode: string | null;
  mpesaAmount: string | null;
  cashAmount: string | null;
  paidAt: string | null;
  createdAt: string;
  cancelReason: string | null;
  cancelledBy: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  prepTickets: PrepTicketSummary[];
}

export interface OrderItemDetail {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  notes: string | null;
}

export interface DeliveryZoneSummary {
  id: string;
  name: string;
  fee: string;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItemDetail[];
  closedAt: string | null;
  deliveryZone: DeliveryZoneSummary | null;
}

export interface CreateOrderItem {
  menuItemId: string;
  quantity: number;
  notes?: string | null;
}

export interface CreateOrderDineIn {
  type: 'DINE_IN';
  tableNumber: string;
  notes?: string;
  items: CreateOrderItem[];
}

export interface CreateOrderTakeAway {
  type: 'TAKE_AWAY';
  notes?: string;
  items: CreateOrderItem[];
}

export interface CreateOrderDelivery {
  type: 'DELIVERY';
  deliveryZoneId: string;
  notes?: string;
  items: CreateOrderItem[];
}

export type CreateOrderDto = CreateOrderDineIn | CreateOrderTakeAway | CreateOrderDelivery;

export interface UpdateOrderItemsDto {
  items: CreateOrderItem[];
}

export interface PrepTicketItemSnapshot {
  menuItemId?: string;
  name: string;
  quantity: number;
  notes: string | null;
}

export interface PrepTicketDetail {
  id: string;
  orderId: string;
  orderDailyNumber: number;
  orderType: OrderType;
  tableNumber: string | null;
  orderNotes: string | null;
  orderPlacedBy: { id: string; name: string };
  station: PrepStation;
  status: PrepTicketStatus;
  claimedBy: { id: string; name: string } | null;
  claimedAt: string | null;
  readyAt: string | null;
  rejectedReason?: string | null;
  items: PrepTicketItemSnapshot[];
  createdAt: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

