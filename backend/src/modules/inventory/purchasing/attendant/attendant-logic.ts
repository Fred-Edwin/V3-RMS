import { Prisma } from '@prisma/client';
import { dayAsDate, nairobiDay, weekdayDateText } from '../../counting/_shared/count-time';
import { restockStatus } from '../../restock/restock-suggestion';
import { roleLabel } from '../_shared/order-view';
import type { OrderStatus } from '../_shared/order-state';
import type { OrderRowView } from '../_shared/purchasing.types';
import { suggestedQty } from '../_shared/money';
import { bestLinePerSupplier, chooseLine, packOf } from '../needs-restocking/needs-restocking-logic';
import type { SupplierLine } from '../needs-restocking/needs-restocking-repository';
import type {
  HistoryMonth,
  HistoryRow,
  MyOrderRow,
  NoticeAction,
  NoticeGroup,
  NoticeType,
  NoticeView,
  OrderNeed,
  RestockLevelRow,
} from './attendant.types';

/** The statuses that are "open" for the person who raised the order: waiting for approval, sent back, approved, or sent. A draft is not shown. */
export const OPEN_FOR_RAISER: readonly OrderStatus[] = ['AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT'];

export const NOTICE_WINDOW_DAYS = 30;
/** The 08:00 Nairobi hour the due and overdue notices carry (Paper 28N). */
const DUE_NOTICE_HOUR = 8;
const HOUR_MS = 3_600_000;
const NAIROBI_OFFSET_HOURS = 3;
const DAY_MS = 86_400_000;

const kes0 = (v: Prisma.Decimal.Value): string => Math.round(Number(v)).toLocaleString('en-US');
/** Name.Role ("Joseph.Store Manager"), the owner's form of 11 Oct 2026. */
const withRole = (p: { name: string; role: string }): string => `${p.name.replace(/\s*\([^)]*\)\s*$/, '')}.${roleLabel(p.role)}`;
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------- My orders

/**
 * What an order needs from the Store Attendant (owner, 10 Oct 2026; Paper 28A and 28F): a returned order needs editing, an approved one
 * needs sending, and a sent one whose delivery is due today or late needs receiving. Everything else waits on someone else.
 */
export const needOf = (status: OrderStatus, expectedDate: string | null, today: string): OrderNeed | null => {
  if (status === 'RETURNED') return 'RETURNED';
  if (status === 'APPROVED') return 'SEND';
  if (status === 'SENT' && expectedDate !== null && expectedDate <= today) return 'RECEIVE';
  return null;
};

export const toMyOrderRow = (row: OrderRowView, today: string): MyOrderRow => {
  const need = needOf(row.status, row.expectedDate, today);
  return { ...row, need, group: need ? 'NEEDS_YOU' : 'WAITING' };
};

export type MyOrdersFilter = 'all' | 'needs' | 'waiting' | 'overdue';

export const countMyOrders = (rows: readonly MyOrderRow[]): { all: number; needs: number; waiting: number; overdue: number } => ({
  all: rows.length,
  needs: rows.filter((r) => r.group === 'NEEDS_YOU').length,
  waiting: rows.filter((r) => r.group === 'WAITING').length,
  overdue: rows.filter((r) => r.dueLabel === 'OVERDUE').length,
});

export const filterMyOrders = (rows: readonly MyOrderRow[], filter: MyOrdersFilter): MyOrderRow[] =>
  rows.filter((r) => (filter === 'all' ? true : filter === 'needs' ? r.group === 'NEEDS_YOU' : filter === 'waiting' ? r.group === 'WAITING' : r.dueLabel === 'OVERDUE'));

// ---------------------------------------------------------------- History

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

export const monthLabel = (key: string): string => {
  const [year, month] = key.split('-');
  return `${MONTHS[Number(month) - 1] ?? key} ${year}`;
};

/** Rows are already newest first; a new month starts a new group. */
export const groupByMonth = (rows: readonly HistoryRow[]): HistoryMonth[] => {
  const months: HistoryMonth[] = [];
  for (const row of rows) {
    const key = row.closedOn.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else months.push({ key, label: monthLabel(key), rows: [row] });
  }
  return months;
};

// ---------------------------------------------------------------- Stock status of an item

export interface ItemFacts {
  id: string;
  name: string;
  usageUnit: string;
  buyUnit: string;
  packSize: Prisma.Decimal | null;
  preferredSupplierId: string | null;
}

export const itemStatus = (onHand: Prisma.Decimal, level: Prisma.Decimal | null): 'OUT' | 'LOW' | 'OK' | 'NO_LEVEL' => restockStatus(onHand, level);

/** The supplier we would buy this item from by default, and the suggested whole buy units (level minus on hand). */
export const defaultBuy = (
  item: ItemFacts,
  lines: readonly SupplierLine[],
  onHand: Prisma.Decimal,
  level: Prisma.Decimal | null,
): { supplier: { id: string; name: string } | null; suggestedQty: string | null } => {
  const chosen = chooseLine(bestLinePerSupplier(lines), item.preferredSupplierId);
  if (!chosen) return { supplier: null, suggestedQty: null };
  const qty = level === null || onHand.gte(level) ? null : suggestedQty(level, onHand, packOf(chosen, item));
  return { supplier: { id: chosen.supplier.id, name: chosen.supplier.name }, suggestedQty: qty === null ? null : String(qty) };
};

// ---------------------------------------------------------------- Restock levels (Paper 28P)

export interface LevelItem extends ItemFacts {
  onHand: Prisma.Decimal;
  level: Prisma.Decimal;
}

const SEVERITY = { OUT: 0, LOW: 1, OK: 2 } as const;

export const buildLevelRows = (items: readonly LevelItem[], lines: readonly SupplierLine[]): RestockLevelRow[] => {
  const byItem = new Map<string, SupplierLine[]>();
  for (const l of lines) byItem.set(l.inventoryItemId, [...(byItem.get(l.inventoryItemId) ?? []), l]);
  return items
    .map((item): RestockLevelRow => {
      const status = itemStatus(item.onHand, item.level);
      const chosen = chooseLine(bestLinePerSupplier(byItem.get(item.id) ?? []), item.preferredSupplierId);
      const ratio = item.level.gt(0) ? item.onHand.div(item.level).toNumber() : 1;
      return {
        inventoryItemId: item.id,
        name: item.name,
        status: status === 'NO_LEVEL' ? 'OK' : status,
        onHand: item.onHand.toString(),
        level: item.level.toString(),
        usageUnit: item.usageUnit,
        fill: Math.max(0, Math.min(1, Math.round(ratio * 100) / 100)),
        supplier: chosen ? { id: chosen.supplier.id, name: chosen.supplier.name } : null,
        // What the New order screen needs to put the item on the list: the unit it is bought in, how many would bring it back to its level, the last price.
        buyUnit: chosen ? (chosen.buyUnit ?? item.buyUnit) : null,
        suggestedQty: chosen ? defaultBuy(item, byItem.get(item.id) ?? [], item.onHand, item.level).suggestedQty : null,
        lastPrice: chosen?.lastPrice ? chosen.lastPrice.toString() : null,
      };
    })
    .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status] || a.fill - b.fill || a.name.localeCompare(b.name));
};

export interface LevelFilter {
  /** `NEEDS` is "Low and out" together (the New order screen's filter). */
  status?: 'OUT' | 'LOW' | 'OK' | 'NEEDS';
  supplierId?: string;
  q?: string;
}

export const filterLevelRows = (rows: readonly RestockLevelRow[], f: LevelFilter): RestockLevelRow[] => {
  const q = f.q?.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!f.status || (f.status === 'NEEDS' ? r.status !== 'OK' : r.status === f.status)) &&
      (!f.supplierId || r.supplier?.id === f.supplierId) &&
      (!q || r.name.toLowerCase().includes(q) || (r.supplier?.name.toLowerCase().includes(q) ?? false)),
  );
};

// ---------------------------------------------------------------- Notifications (Paper 28N), derived from the orders

export interface NoticeOrder {
  id: string;
  reference: string | null;
  status: OrderStatus;
  /** `YYYY-MM-DD` or null. */
  expectedDate: string | null;
  supplierName: string;
  itemCount: number;
  total: Prisma.Decimal;
  raisedById: string;
  approvedAt: Date | null;
  approver: { id: string; name: string; role: string } | null;
  returnedAt: Date | null;
  returnedNote: string | null;
  returner: { name: string; role: string } | null;
  closedAt: Date | null;
}

export interface NoticeContext {
  actorId: string;
  /** Holds `orders.receive`: due and overdue deliveries are theirs to receive. */
  canReceive: boolean;
  /** May see item prices (the "KES 16,050" on an approval). */
  seesCosts: boolean;
  now: Date;
  /** Keys the person has opened. */
  read: ReadonlySet<string>;
}

/** 08:00 Nairobi on a `YYYY-MM-DD` day, as an instant. */
export const dueNoticeAt = (day: string): Date => new Date(dayAsDate(day).getTime() + (DUE_NOTICE_HOUR - NAIROBI_OFFSET_HOURS) * HOUR_MS);

const addDays = (day: string, n: number): string => new Date(dayAsDate(day).getTime() + n * DAY_MS).toISOString().slice(0, 10);
const daysBetweenDays = (earlier: string, later: string): number => Math.round((dayAsDate(later).getTime() - dayAsDate(earlier).getTime()) / DAY_MS);

type Draft = { type: NoticeType; at: Date; key: string; title: string; body: string; action: NoticeAction | null; order: NoticeOrder };

/**
 * The notices of one person: events on the orders THEY raised (approved, sent back, closed), plus the deliveries due today and
 * overdue that any Attendant can receive. Nothing is stored except which ones were opened: an order that moves on loses its button.
 */
export const deriveNotices = (orders: readonly NoticeOrder[], ctx: NoticeContext): NoticeView[] => {
  const today = nairobiDay(ctx.now);
  const since = new Date(ctx.now.getTime() - NOTICE_WINDOW_DAYS * DAY_MS);
  const drafts: Draft[] = [];

  for (const o of orders) {
    const mine = o.raisedById === ctx.actorId;
    if (mine && o.status === 'RETURNED' && o.returnedAt && o.returner) {
      drafts.push({ type: 'RETURNED', at: o.returnedAt, key: `RETURNED:${o.id}:${o.returnedAt.getTime()}`, title: `${withRole(o.returner)} sent it back`, body: o.returnedNote ? `"${o.returnedNote}"` : 'Open it to see what to change.', action: 'EDIT_AND_RESEND', order: o });
    }
    if (mine && o.approvedAt && o.approver && o.approver.id !== ctx.actorId) {
      const ready = o.status === 'APPROVED';
      const money = ctx.seesCosts ? ` · KES ${kes0(o.total)}` : '';
      drafts.push({
        type: 'APPROVED',
        at: o.approvedAt,
        key: `APPROVED:${o.id}`,
        title: `${withRole(o.approver)} approved it`,
        body: ready ? `Ready to send${money}` : o.status === 'SENT' ? `Approved and sent${money}` : `Approved${money}`,
        action: ready ? 'PRINT_OR_SHARE' : null,
        order: o,
      });
    }
    if (ctx.canReceive && o.status === 'SENT' && o.expectedDate) {
      if (o.expectedDate === today) {
        const at = dueNoticeAt(today);
        if (ctx.now >= at) drafts.push({ type: 'DUE_TODAY', at, key: `DUE_TODAY:${o.id}`, title: 'Delivery due today', body: `${o.supplierName} is due to deliver`, action: 'RECEIVE_DELIVERY', order: o });
      } else if (o.expectedDate < today) {
        const late = daysBetweenDays(o.expectedDate, today);
        const at = dueNoticeAt(addDays(o.expectedDate, 1));
        drafts.push({ type: 'OVERDUE', at, key: `OVERDUE:${o.id}`, title: `${plural(late, 'day')} overdue`, body: `${o.supplierName} has not delivered`, action: 'CALL_SUPPLIER', order: o });
      }
    }
    if (mine && o.status === 'CLOSED' && o.closedAt) {
      drafts.push({ type: 'CLOSED', at: o.closedAt, key: `CLOSED:${o.id}`, title: 'Order closed', body: 'Paid in full', action: null, order: o });
    }
  }

  return drafts
    .filter((d) => d.at >= since)
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .map(
      (d): NoticeView => ({
        key: d.key,
        type: d.type,
        at: d.at.toISOString(),
        orderId: d.order.id,
        reference: d.order.reference,
        supplierName: d.order.supplierName,
        itemCount: d.order.itemCount,
        title: d.title,
        body: d.body,
        action: d.action,
        unread: !ctx.read.has(d.key),
      }),
    );
};

export const countNotices = (notices: readonly NoticeView[]): { all: number; unread: number; needsMe: number } => ({
  all: notices.length,
  unread: notices.filter((n) => n.unread).length,
  needsMe: notices.filter((n) => n.action !== null).length,
});

/** `Today`, `Yesterday`, then `Wed 7 Oct`: whole Nairobi days. */
export const groupNotices = (notices: readonly NoticeView[], now: Date): NoticeGroup[] => {
  const today = nairobiDay(now);
  const yesterday = addDays(today, -1);
  const groups: NoticeGroup[] = [];
  for (const n of notices) {
    const at = new Date(n.at);
    const day = nairobiDay(at);
    const label = day === today ? 'Today' : day === yesterday ? 'Yesterday' : weekdayDateText(at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.notices.push(n);
    else groups.push({ label, day, notices: [n] });
  }
  return groups;
};
