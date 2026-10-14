/**
 * Wire shapes of the Store Attendant's Purchasing phone (Paper chapter 9, steps 28A to 28Q). Mirrors the back end's
 * `attendant/attendant.types.ts` and `restock-list/restock-list.types.ts`; documented in docs/features/inventory/purchasing-attendant-api.md.
 * Decimals are strings, dates are ISO strings, Nairobi days are `YYYY-MM-DD`.
 */
import type { CollectedByInput, Order, OrderRow, Person } from './index';

export type OrderNeed = 'RETURNED' | 'SEND' | 'RECEIVE';

export interface MyOrderRow extends OrderRow {
  group: 'NEEDS_YOU' | 'WAITING';
  need: OrderNeed | null;
}

export type Approver = Person | null;

export interface Badges {
  receiving: number;
  restock: number;
  myOrders: number;
  unreadNotices: number;
}

export interface HomeView {
  restock: { total: number; out: number; low: number };
  needsYou: MyOrderRow[];
  myOrders: { rows: MyOrderRow[]; total: number; needYou: number };
  approver: Approver;
  badges: Badges;
  today: string;
}

export type MyOrdersFilter = 'all' | 'needs' | 'waiting' | 'overdue';

export interface MyOrdersView {
  counts: { all: number; needs: number; waiting: number; overdue: number };
  filter: MyOrdersFilter;
  needsYou: MyOrderRow[];
  waitingOnOthers: MyOrderRow[];
  approver: Approver;
}

export type HistoryStatus = 'all' | 'paid' | 'cancelled';

export interface HistoryQuery {
  from?: string;
  to?: string;
  status?: HistoryStatus;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface HistoryRow {
  id: string;
  reference: string | null;
  supplier: { id: string; name: string };
  itemCount: number;
  shortCount: number;
  value: string;
  valueKind: 'DELIVERED' | 'ORDERED';
  outcome: 'PAID' | 'CANCELLED';
  cancelReason: string | null;
  closedOn: string;
}

export interface HistoryMonth {
  key: string;
  label: string;
  rows: HistoryRow[];
}

export interface HistoryView {
  range: { from: string; to: string };
  summary: { allTime: number; inRange: number };
  page: number;
  pageSize: number;
  total: number;
  months: HistoryMonth[];
}

export type ItemStatus = 'OUT' | 'LOW' | 'OK' | 'NO_LEVEL';

export interface SearchItem {
  inventoryItemId: string;
  name: string;
  status: ItemStatus;
  onHand?: string;
  level?: string;
  usageUnit: string;
  buyUnit: string;
  suggestedQty: string | null;
  supplier: { id: string; name: string } | null;
  onOpenOrder: { orderId: string; reference: string | null } | null;
}

export interface SearchView {
  q: string;
  counts: { items: number; suppliers: number; orders: number };
  items: SearchItem[];
  suppliers: Array<{ id: string; name: string; openOrderCount: number; itemCount: number }>;
  orders: Array<{
    id: string;
    reference: string | null;
    supplier: { id: string; name: string };
    status: OrderRow['status'];
    stage: OrderRow['stage'];
    dueLabel: OrderRow['dueLabel'];
    expectedDate: string | null;
    closedOn: string | null;
    itemCount: number;
  }>;
}

export interface SupplierItemRow {
  inventoryItemId: string;
  name: string;
  price: string;
  status: ItemStatus;
  onHand?: string;
  level?: string;
  usageUnit: string;
  buyUnit: string;
  suggestedQty: string | null;
  onOpenOrder: boolean;
}

export interface SupplierPageView {
  supplier: {
    id: string;
    name: string;
    code: string;
    category: string | null;
    contactName: string | null;
    phone: string | null;
    whatsapp: string | null;
    status: 'ACTIVE' | 'ON_HOLD' | 'ARCHIVED';
  };
  openOrder: OrderRow | null;
  items: SupplierItemRow[];
  lowCount: number;
}

export interface RestockLevelsQuery {
  /** `NEEDS` is Low and out together (New order). */
  status?: 'OUT' | 'LOW' | 'OK' | 'NEEDS';
  supplierId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface RestockLevelRow {
  inventoryItemId: string;
  name: string;
  status: 'OUT' | 'LOW' | 'OK';
  onHand: string;
  level: string;
  usageUnit: string;
  fill: number;
  supplier: { id: string; name: string } | null;
  buyUnit: string | null;
  suggestedQty: string | null;
  lastPrice: string | null;
}

export interface RestockLevelsView {
  counts: { all: number; out: number; low: number; ok: number };
  page: number;
  pageSize: number;
  total: number;
  suppliers: Array<{ id: string; name: string }>;
  rows: RestockLevelRow[];
  setBy: Approver;
}

export type NoticeType = 'RETURNED' | 'APPROVED' | 'DUE_TODAY' | 'OVERDUE' | 'CLOSED';
export type NoticeAction = 'EDIT_AND_RESEND' | 'PRINT_OR_SHARE' | 'RECEIVE_DELIVERY' | 'CALL_SUPPLIER';

export interface NoticeView {
  key: string;
  type: NoticeType;
  at: string;
  orderId: string;
  reference: string | null;
  supplierName: string;
  itemCount: number;
  title: string;
  body: string;
  action: NoticeAction | null;
  unread: boolean;
}

export interface NoticeGroup {
  label: string;
  day: string;
  notices: NoticeView[];
}

export type NoticesFilter = 'all' | 'unread' | 'needs';

export interface NoticesView {
  counts: { all: number; unread: number; needsMe: number };
  groups: NoticeGroup[];
}

// --- Review and send (28C) --------------------------------------------------------------------------------------------------------

export interface RestockListLine {
  inventoryItemId: string;
  qty: string;
  supplierId?: string;
}

export interface ReviewLine {
  inventoryItemId: string;
  itemName: string;
  qty: string;
  buyUnit: string;
  unitPrice: string | null;
  lineTotal: string | null;
}

export type GroupProblem = 'SUPPLIER_ORDER_OPEN' | 'ITEM_SETUP_INCOMPLETE';

export interface ReviewGroup {
  supplier: { id: string; name: string; code: string };
  orderNumber: number;
  itemCount: number;
  estimatedTotal: string;
  openOrder: { id: string; reference: string | null } | null;
  problem: GroupProblem | null;
  lines: ReviewLine[];
}

export interface RestockReview {
  groups: ReviewGroup[];
  unsupplied: Array<{ inventoryItemId: string; itemName: string }>;
  orderCount: number;
  estimatedTotal: string;
  approver: Approver;
}

export interface RestockSendResult {
  sent: Array<{ supplier: { id: string; name: string }; order: Order }>;
  failed: Array<{ supplier: { id: string; name: string }; code: string; message: string; orderId: string | null }>;
  unsupplied: Array<{ inventoryItemId: string; itemName: string }>;
}

export interface CollectorOptions {
  carriers: Array<{ id: string; name: string; kind: 'PERSON' | 'VEHICLE' | 'COMPANY' }>;
  staff: Array<{ id: string; name: string; role: string }>;
}

export type { CollectedByInput };
