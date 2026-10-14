/**
 * Wire shapes of the Store Attendant's Purchasing phone (Paper chapter 9, steps 28A to 28Q). Decimals are strings, dates are ISO
 * strings. The order rows reuse `OrderRowView` (`_shared/purchasing.types.ts`) so an order looks the same on every list.
 * Documented in docs/features/inventory/purchasing-attendant-api.md.
 */
import type { OrderRowView, Person } from '../_shared/purchasing.types';

/** What an order needs from the Store Attendant right now (null: it is waiting on someone else). */
export type OrderNeed = 'RETURNED' | 'SEND' | 'RECEIVE';

export interface MyOrderRow extends OrderRowView {
  group: 'NEEDS_YOU' | 'WAITING';
  need: OrderNeed | null;
}

/** The Store Manager the Attendant's orders wait on ("Waiting for Joseph (Store Manager)"). Null when none is active. */
export type Approver = Person | null;

export interface Badges {
  /** Orders to receive (the Receiving link, map row 12). */
  receiving: number;
  /** Items that need restocking (the Restock list link). */
  restock: number;
  /** The Attendant's own orders that need them (the My orders link). */
  myOrders: number;
  /** The bell. */
  unreadNotices: number;
}

export interface HomeView {
  restock: { total: number; out: number; low: number };
  /** Ready to send, returned, and deliveries due today or overdue: the "Needs you now" list. */
  needsYou: MyOrderRow[];
  /** The caller's own open orders, newest first (the home shows the first few; `total` is all of them). */
  myOrders: { rows: MyOrderRow[]; total: number; needYou: number };
  approver: Approver;
  badges: Badges;
  /** The Nairobi day the figures are for, `YYYY-MM-DD`. */
  today: string;
}

export interface MyOrdersView {
  /** Chip counts, always for the whole set whatever the filter or search. */
  counts: { all: number; needs: number; waiting: number; overdue: number };
  filter: 'all' | 'needs' | 'waiting' | 'overdue';
  needsYou: MyOrderRow[];
  waitingOnOthers: MyOrderRow[];
  approver: Approver;
}

export interface HistoryRow {
  id: string;
  reference: string | null;
  supplier: { id: string; name: string };
  itemCount: number;
  /** Lines delivered short or not supplied ("1 short"). */
  shortCount: number;
  /** The delivered value of a closed order, the ordered value of a cancelled one. Empty for a caller blind to item prices. Never an invoice or payment figure. */
  value: string;
  valueKind: 'DELIVERED' | 'ORDERED';
  outcome: 'PAID' | 'CANCELLED';
  /** WITHDRAWN when the person who raised it took it back before approval; null for a paid order. */
  cancelReason: string | null;
  /** The Nairobi day it closed or was cancelled, `YYYY-MM-DD`. */
  closedOn: string;
}

export interface HistoryMonth {
  /** `2026-10`. */
  key: string;
  /** `October 2026`. */
  label: string;
  rows: HistoryRow[];
}

export interface HistoryView {
  range: { from: string; to: string };
  /** Every closed or cancelled order, and how many fall in the range (the header "46 orders · Last 30 days: 12"). */
  summary: { allTime: number; inRange: number };
  page: number;
  pageSize: number;
  /** Orders matching the range, status and search: the pager's "of 46". */
  total: number;
  months: HistoryMonth[];
}

export interface SearchItem {
  inventoryItemId: string;
  name: string;
  status: 'OUT' | 'LOW' | 'OK' | 'NO_LEVEL';
  /** Stock figures: present for a caller holding `orders.see_stock` or `restock.read`. */
  onHand?: string;
  level?: string;
  usageUnit: string;
  buyUnit: string;
  suggestedQty: string | null;
  supplier: { id: string; name: string } | null;
  /** The open order that already holds this item, when there is one. */
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
    status: OrderRowView['status'];
    stage: OrderRowView['stage'];
    dueLabel: OrderRowView['dueLabel'];
    expectedDate: string | null;
    /** The Nairobi day a closed or cancelled order closed. */
    closedOn: string | null;
    itemCount: number;
  }>;
}

export interface SupplierItemRow {
  inventoryItemId: string;
  name: string;
  /** The last price we paid; empty for a caller blind to item prices. */
  price: string;
  status: 'OUT' | 'LOW' | 'OK' | 'NO_LEVEL';
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
  /** The supplier's one open order, when there is one. */
  openOrder: OrderRowView | null;
  items: SupplierItemRow[];
  /** Items out or low and not already on an order: what "Add N low items to my list" adds. */
  lowCount: number;
}

export interface RestockLevelRow {
  inventoryItemId: string;
  name: string;
  status: 'OUT' | 'LOW' | 'OK';
  onHand: string;
  level: string;
  usageUnit: string;
  /** `onHand / level` capped at 1, for the coloured bar. */
  fill: number;
  supplier: { id: string; name: string } | null;
  /** The unit the item is bought in, the whole units that bring it back to its level, and the last price per unit: null when there is no supplier line. */
  buyUnit: string | null;
  suggestedQty: string | null;
  lastPrice: string | null;
}

export interface RestockLevelsView {
  counts: { all: number; out: number; low: number; ok: number };
  page: number;
  pageSize: number;
  total: number;
  /** The suppliers that appear in the list, for the Supplier filter. */
  suppliers: Array<{ id: string; name: string }>;
  rows: RestockLevelRow[];
  /** Who sets the levels ("Levels are set by Joseph (Store Manager)"). */
  setBy: Approver;
}

export type NoticeType = 'RETURNED' | 'APPROVED' | 'DUE_TODAY' | 'OVERDUE' | 'CLOSED';
export type NoticeAction = 'EDIT_AND_RESEND' | 'PRINT_OR_SHARE' | 'RECEIVE_DELIVERY' | 'CALL_SUPPLIER';

export interface NoticeView {
  /** `TYPE:orderId` (a return adds the time, so a second return of the same order is a new notice). */
  key: string;
  type: NoticeType;
  at: string;
  orderId: string;
  reference: string | null;
  supplierName: string;
  itemCount: number;
  title: string;
  body: string;
  /** The one button on the row, while the order is still in the state that made the notice; null once it has moved on. */
  action: NoticeAction | null;
  unread: boolean;
}

export interface NoticeGroup {
  /** `Today`, `Yesterday`, or `Wed 7 Oct`. */
  label: string;
  day: string;
  notices: NoticeView[];
}

export interface NoticesView {
  counts: { all: number; unread: number; needsMe: number };
  groups: NoticeGroup[];
}
