import type {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PrepStation,
  PrepTicketStatus,
  Prisma,
} from '@prisma/client';

export interface PrepTicketItemSnapshot {
  menuItemId?: string;
  name: string;
  quantity: number;
  notes: string | null;
}

export interface OrderItemRecord {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  notes: string | null;
}

export interface PrepTicketRecord {
  id: string;
  orderId: string;
  station: PrepStation;
  status: PrepTicketStatus;
  claimedById: string | null;
  claimedBy: {
    id: string;
    name: string;
  } | null;
  claimedAt: Date | null;
  readyAt: Date | null;
  rejectedReason?: string | null;
  items: PrepTicketItemSnapshot[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PrepTicketSummaryRecord {
  id: string;
  station: PrepStation;
  status: PrepTicketStatus;
  claimedBy: {
    id: string;
    name: string;
  } | null;
  claimedAt: Date | null;
  readyAt: Date | null;
  rejectedReason?: string | null;
  /** Human-readable label derived from the single item snapshot, e.g. "Latte x3" */
  itemLabel: string;
}

export interface OrderSummaryRecord {
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
  cardAmount: string | null;
  splitType: string | null;
  paidAt: Date | null;
  cancelReason: string | null;
  cancelledBy: { id: string; name: string } | null;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string;
  };
  prepTickets: PrepTicketSummaryRecord[];
}

export interface OrderRecord {
  id: string;
  organizationId: string;
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
  cardAmount: string | null;
  splitType: string | null;
  paidAt: Date | null;
  cancelReason: string | null;
  cancelledBy: { id: string; name: string } | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string;
  };
  deliveryZone: {
    id: string;
    name: string;
    fee: string;
  } | null;
  items: OrderItemRecord[];
  prepTickets: PrepTicketRecord[];
}

export interface CreateOrderItemWithPriceDto {
  menuItemId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  notes: string | null;
}

export interface CreatePrepTicketDto {
  organizationId: string;
  station: PrepStation;
  status: PrepTicketStatus;
  items: PrepTicketItemSnapshot[];
}

export interface CreateOrderWithTicketsDto {
  organizationId: string;
  orderDate: Date;
  type: OrderType;
  status: OrderStatus;
  tableNumber: string | null;
  notes: string | null;
  subtotal: Prisma.Decimal;
  deliveryFee: Prisma.Decimal;
  total: Prisma.Decimal;
  deliveryZoneId: string | null;
  createdById: string;
  items: CreateOrderItemWithPriceDto[];
  prepTickets: CreatePrepTicketDto[];
}

