import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { locationRepository } from '../../../../repositories/location-repository';
import { NotFoundError } from '../../../../utils/errors';
import { blindnessOf } from '../../_shared/blind-rule';
import { actorCan, requireHubReader } from '../../_shared/central-store-access';
import { dayAsDate, nairobiDay } from '../../counting/_shared/count-time';
import { orderedTotal, suggestedQty, toMoney, toQty } from '../_shared/money';
import { dueInDaysOf, dueLabelOf, stageOf } from '../_shared/order-state';
import { roleLabel, viewRow } from '../_shared/order-view';
import { purchasingError } from '../_shared/purchasing-errors';
import { packOf } from '../needs-restocking/needs-restocking-logic';
import { needsRestockingRepository, type Scope } from '../needs-restocking/needs-restocking-repository';
import { needsRestockingService } from '../needs-restocking/needs-restocking-service';
import { ordersRepository } from '../orders/orders-repository';
import {
  OPEN_FOR_RAISER,
  NOTICE_WINDOW_DAYS,
  buildLevelRows,
  countMyOrders,
  countNotices,
  defaultBuy,
  deriveNotices,
  filterLevelRows,
  filterMyOrders,
  groupByMonth,
  groupNotices,
  itemStatus,
  toMyOrderRow,
  type NoticeOrder,
} from './attendant-logic';
import { attendantRepository, type HistoryRecord, type NoticeRecord } from './attendant-repository';
import type {
  Approver,
  Badges,
  HistoryRow,
  HistoryView,
  HomeView,
  MyOrderRow,
  MyOrdersView,
  NoticesView,
  RestockLevelsView,
  SearchView,
  SupplierItemRow,
  SupplierPageView,
} from './attendant.types';
import type { HistoryQuery, MyOrdersQuery, NoticesQuery, RestockLevelsQuery } from './attendant-validators';

type Actor = NonNullable<Request['user']>;

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const LIST_LIMIT = 200;
const HOME_ROWS = 5;
const SEARCH_ITEMS = 20;
const SEARCH_SUPPLIERS = 10;
const SEARCH_ORDERS = 20;

const addDays = (day: string, n: number): string => new Date(dayAsDate(day).getTime() + n * DAY_MS).toISOString().slice(0, 10);
/** The instant a Nairobi day starts (00:00 Nairobi, which is 21:00 UTC the day before). */
const dayStart = (day: string): Date => new Date(dayAsDate(day).getTime() - 3 * HOUR_MS);

/** On hand and the reorder level are shown to a person who may see stock (`restock.read`) or order from it (`orders.see_stock`). */
const seesStock = (actor: Actor): boolean => actorCan(actor, 'restock.read') || actorCan(actor, 'orders.see_stock');

const scopeOf = async (actor: Actor): Promise<Scope> => {
  const siteId = await requireHubReader(actor);
  const centralStore = await locationRepository.findCentralStore();
  if (!centralStore || centralStore.siteId !== siteId) throw new NotFoundError('No Central Store is configured for this organization');
  return { siteId, locationId: centralStore.id };
};

const approverOf = async (siteId: string): Promise<Approver> => {
  const a = await attendantRepository.findApprover(siteId);
  return a ? { id: a.id, name: a.name, role: roleLabel(a.role) } : null;
};

const noticeOrderOf = (r: NoticeRecord): NoticeOrder => ({
  id: r.id,
  reference: r.reference,
  status: r.status,
  expectedDate: r.expectedDate ? r.expectedDate.toISOString().slice(0, 10) : null,
  supplierName: r.supplier.name,
  itemCount: r.lines.length,
  total: orderedTotal(r.lines),
  raisedById: r.raisedById,
  approvedAt: r.approvedAt,
  approver: r.approvedBy,
  returnedAt: r.returnedAt,
  returnedNote: r.returnedNote,
  returner: r.returnedBy,
  closedAt: r.closedAt,
});

const historyRowOf = (actor: Actor, r: HistoryRecord): HistoryRow => {
  const delivered = r.delivery?.deliveredTotal ?? null;
  const when = r.closedAt ?? r.cancelledAt ?? new Date(0);
  return {
    id: r.id,
    reference: r.reference,
    supplier: r.supplier,
    itemCount: r.lines.length,
    shortCount: r.lines.filter((l) => l.result === 'SHORT' || l.result === 'NOT_SUPPLIED').length,
    // The delivered value of a closed order, the ordered value of a cancelled one; never an invoice or a payment.
    value: blindnessOf(actor).itemCosts ? '' : toMoney(delivered ?? orderedTotal(r.lines)),
    valueKind: delivered === null ? 'ORDERED' : 'DELIVERED',
    outcome: r.status === 'CLOSED' ? 'PAID' : 'CANCELLED',
    cancelReason: r.status === 'CANCELLED' ? r.cancelReason : null,
    closedOn: nairobiDay(when),
  };
};

/** The caller's own open orders, classified by what they need from the caller. */
const loadMine = async (actor: Actor, siteId: string, today: string, now: Date, q?: string): Promise<MyOrderRow[]> => {
  const rows = await ordersRepository.list(siteId, { statuses: OPEN_FOR_RAISER, raisedById: actor.id, q }, LIST_LIMIT);
  return rows
    .map((o) => viewRow(actor, o, now))
    .sort((a, b) => (b.submittedAt ?? b.raisedAt).localeCompare(a.submittedAt ?? a.raisedAt))
    .map((r) => toMyOrderRow(r, today));
};

const loadNotices = async (actor: Actor, siteId: string, now: Date) => {
  const since = new Date(now.getTime() - NOTICE_WINDOW_DAYS * DAY_MS);
  const today = dayAsDate(nairobiDay(now));
  const canReceive = actorCan(actor, 'orders.receive');
  const [records, read] = await Promise.all([attendantRepository.findNoticeOrders(siteId, actor.id, since, today, canReceive), attendantRepository.findReadKeys(actor.id)]);
  return deriveNotices(records.map(noticeOrderOf), { actorId: actor.id, canReceive, seesCosts: !blindnessOf(actor).itemCosts, now, read });
};

export const attendantService = {
  /** The purchasing home (28A): the restock card, what needs the caller now, their open orders, the bell. */
  getHome: async (actor: Actor, now: Date = new Date()): Promise<HomeView> => {
    const siteId = await requireHubReader(actor);
    const today = nairobiDay(now);
    const [needs, mine, sent, byStatus, notices, approver] = await Promise.all([
      needsRestockingService.getNeeds(actor, {}),
      loadMine(actor, siteId, today, now),
      ordersRepository.list(siteId, { statuses: ['SENT'] }, LIST_LIMIT),
      ordersRepository.countByStatus(siteId),
      loadNotices(actor, siteId, now),
      approverOf(siteId),
    ]);
    const lines = needs.groups.flatMap((g) => g.lines);
    const mineIds = new Set(mine.map((m) => m.id));
    // Receiving is everyone's job: a delivery due today or late needs the caller even when someone else raised the order.
    const othersToReceive =
      actorCan(actor, 'orders.receive') ? sent.filter((o) => !mineIds.has(o.id)).map((o) => toMyOrderRow(viewRow(actor, o, now), today)).filter((r) => r.need === 'RECEIVE') : [];
    const needsYou = [...mine.filter((m) => m.need !== null), ...othersToReceive];
    const myNeed = mine.filter((m) => m.need !== null).length;
    return {
      restock: { total: needs.itemCount, out: lines.filter((l) => l.status === 'OUT').length, low: lines.filter((l) => l.status === 'LOW').length },
      needsYou,
      myOrders: { rows: mine.slice(0, HOME_ROWS), total: mine.length, needYou: myNeed },
      approver,
      badges: {
        receiving: byStatus.filter((r) => stageOf(r.status) === 'RECEIVE').reduce((t, r) => t + r.count, 0),
        restock: needs.itemCount,
        myOrders: myNeed,
        unreadNotices: countNotices(notices).unread,
      },
      today,
    };
  },

  /** The counts behind the menu drawer and the bell, for every screen. */
  getBadges: async (actor: Actor, now: Date = new Date()): Promise<Badges> => {
    const siteId = await requireHubReader(actor);
    const today = nairobiDay(now);
    const [restock, byStatus, mine, notices] = await Promise.all([
      needsRestockingService.countNeeds(actor),
      ordersRepository.countByStatus(siteId),
      loadMine(actor, siteId, today, now),
      loadNotices(actor, siteId, now),
    ]);
    return {
      receiving: byStatus.filter((r) => stageOf(r.status) === 'RECEIVE').reduce((t, r) => t + r.count, 0),
      restock,
      myOrders: mine.filter((m) => m.need !== null).length,
      unreadNotices: countNotices(notices).unread,
    };
  },

  /** My orders (28F): the caller's open orders in "Needs you" and "Waiting on others", with chip counts. */
  getMyOrders: async (actor: Actor, query: MyOrdersQuery, now: Date = new Date()): Promise<MyOrdersView> => {
    const siteId = await requireHubReader(actor);
    const today = nairobiDay(now);
    const [rows, approver] = await Promise.all([loadMine(actor, siteId, today, now, query.q), approverOf(siteId)]);
    const shown = filterMyOrders(rows, query.filter);
    return {
      counts: countMyOrders(rows),
      filter: query.filter,
      needsYou: shown.filter((r) => r.group === 'NEEDS_YOU'),
      waitingOnOthers: shown.filter((r) => r.group === 'WAITING'),
      approver,
    };
  },

  /** History (28G): closed and cancelled orders by month. The delivered value only; never an invoice or a payment. */
  getHistory: async (actor: Actor, query: HistoryQuery, now: Date = new Date()): Promise<HistoryView> => {
    const siteId = await requireHubReader(actor);
    const today = nairobiDay(now);
    const to = query.to ?? today;
    const from = query.from ?? addDays(to, -29);
    if (from > to) throw purchasingError('DATE_RANGE_INVALID', 'The start date is after the end date.');
    if (to > today) throw purchasingError('DATE_RANGE_INVALID', "Later dates can't be picked.");
    const fromAt = dayStart(from);
    const toExclusive = dayStart(addDays(to, 1));
    const { ids, total } = await attendantRepository.listClosedIds(siteId, { from: fromAt, toExclusive, status: query.status, q: query.q, raisedById: query.raisedBy }, (query.page - 1) * query.pageSize, query.pageSize);
    const [records, summary] = await Promise.all([attendantRepository.findHistoryRecords(siteId, ids), attendantRepository.countClosed(siteId, fromAt, toExclusive)]);
    return { range: { from, to }, summary, page: query.page, pageSize: query.pageSize, total, months: groupByMonth(records.map((r) => historyRowOf(actor, r))) };
  },

  /** Search (28E): items, suppliers and orders in one answer. */
  search: async (actor: Actor, q: string, now: Date = new Date()): Promise<SearchView> => {
    const scope = await scopeOf(actor);
    const today = nairobiDay(now);
    const [items, itemTotal, suppliers, orders] = await Promise.all([
      attendantRepository.searchItems(scope, q, SEARCH_ITEMS),
      attendantRepository.countItems(scope.siteId, q),
      attendantRepository.searchSuppliers(scope.siteId, q, SEARCH_SUPPLIERS),
      attendantRepository.searchOrders(scope.siteId, q, SEARCH_ORDERS),
    ]);
    const ids = items.map((i) => i.id);
    const [lines, onOrder] = await Promise.all([needsRestockingRepository.findSupplierLines(scope.siteId, ids), attendantRepository.findOpenOrderLines(scope.siteId, ids)]);
    const showStock = seesStock(actor);
    return {
      q,
      counts: { items: itemTotal, suppliers: suppliers.total, orders: orders.total },
      items: items.map((i) => {
        const buy = defaultBuy(i, lines.filter((l) => l.inventoryItemId === i.id), i.onHand, i.level);
        return {
          inventoryItemId: i.id,
          name: i.name,
          status: itemStatus(i.onHand, i.level),
          ...(showStock ? { onHand: toQty(i.onHand), ...(i.level ? { level: toQty(i.level) } : {}) } : {}),
          usageUnit: i.usageUnit,
          buyUnit: i.buyUnit,
          suggestedQty: buy.suggestedQty,
          supplier: buy.supplier,
          onOpenOrder: onOrder.get(i.id) ?? null,
        };
      }),
      suppliers: suppliers.rows,
      orders: orders.rows.map((o) => {
        const expected = o.expectedDate ? o.expectedDate.toISOString().slice(0, 10) : null;
        const when = o.closedAt ?? o.cancelledAt;
        return {
          id: o.id,
          reference: o.reference,
          supplier: o.supplier,
          status: o.status,
          stage: stageOf(o.status),
          dueLabel: dueLabelOf(dueInDaysOf({ status: o.status, expectedDate: expected, invoiceDueDate: null }, today)),
          expectedDate: expected,
          closedOn: when ? nairobiDay(when) : null,
          itemCount: o.lineCount,
        };
      }),
    };
  },

  /** A supplier's page (28M): who to call, the open order, what we buy from them and how it is stocked. */
  getSupplier: async (actor: Actor, id: string, now: Date = new Date()): Promise<SupplierPageView> => {
    const scope = await scopeOf(actor);
    const supplier = await attendantRepository.findSupplierPage(scope.siteId, id);
    if (!supplier) throw purchasingError('SUPPLIER_NOT_FOUND', 'That supplier does not exist.');
    const lines = await attendantRepository.findSupplierLinesWithItems(scope.siteId, id);
    const ids = lines.map((l) => l.inventoryItemId);
    const [stock, onOrder, open] = await Promise.all([
      needsRestockingRepository.findStockForItems(scope, ids),
      attendantRepository.findOpenOrderLines(scope.siteId, ids),
      ordersRepository.list(scope.siteId, { statuses: OPEN_FOR_RAISER, supplierId: id }, 1),
    ]);
    const stockOf = new Map(stock.map((s) => [s.inventoryItemId, s]));
    const blind = blindnessOf(actor).itemCosts;
    const showStock = seesStock(actor);
    const items: SupplierItemRow[] = lines.map((l) => {
      const s = stockOf.get(l.inventoryItemId);
      const onHand = s?.onHand ?? new Prisma.Decimal(0);
      const level = s?.level ?? null;
      const status = itemStatus(onHand, level);
      const qty = level === null || onHand.gte(level) ? null : suggestedQty(level, onHand, packOf(l, l.item));
      return {
        inventoryItemId: l.inventoryItemId,
        name: l.item.name,
        price: blind || !l.lastPrice ? '' : toMoney(l.lastPrice),
        status,
        ...(showStock ? { onHand: toQty(onHand), ...(level ? { level: toQty(level) } : {}) } : {}),
        usageUnit: l.item.usageUnit,
        buyUnit: l.buyUnit ?? l.item.buyUnit,
        suggestedQty: qty === null ? null : String(qty),
        onOpenOrder: onOrder.has(l.inventoryItemId),
      };
    });
    const first = open[0];
    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        code: supplier.code,
        category: supplier.category,
        contactName: supplier.contact?.name ?? null,
        phone: supplier.contact?.phone ?? supplier.contact?.whatsapp ?? null,
        whatsapp: supplier.contact?.whatsapp ?? supplier.contact?.phone ?? null,
        status: supplier.status,
      },
      openOrder: first ? viewRow(actor, first, now) : null,
      items,
      lowCount: items.filter((i) => (i.status === 'OUT' || i.status === 'LOW') && !i.onOpenOrder).length,
    };
  },

  /** Restock levels (28P): on hand against the reorder level, read only (levels are set in Catalog). */
  getRestockLevels: async (actor: Actor, query: RestockLevelsQuery): Promise<RestockLevelsView> => {
    const scope = await scopeOf(actor);
    const items = await attendantRepository.findLevelItems(scope);
    const lines = await needsRestockingRepository.findSupplierLines(scope.siteId, items.map((i) => i.id));
    const all = buildLevelRows(items, lines);
    const filtered = filterLevelRows(all, { status: query.status, supplierId: query.supplierId, q: query.q });
    const supplierNames = new Map(all.flatMap((r) => (r.supplier ? [[r.supplier.id, r.supplier.name] as const] : [])));
    return {
      counts: { all: all.length, out: all.filter((r) => r.status === 'OUT').length, low: all.filter((r) => r.status === 'LOW').length, ok: all.filter((r) => r.status === 'OK').length },
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length,
      suppliers: [...supplierNames].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      rows: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
      setBy: await approverOf(scope.siteId),
    };
  },

  // ------------------------------------------------------------ notifications (28N)

  getNotices: async (actor: Actor, query: NoticesQuery, now: Date = new Date()): Promise<NoticesView> => {
    const siteId = await requireHubReader(actor);
    const all = await loadNotices(actor, siteId, now);
    const shown = query.filter === 'unread' ? all.filter((n) => n.unread) : query.filter === 'needs' ? all.filter((n) => n.action !== null) : all;
    return { counts: countNotices(all), groups: groupNotices(shown, now) };
  },

  markNoticesRead: async (actor: Actor, keys: readonly string[], now: Date = new Date()): Promise<void> => {
    await requireHubReader(actor);
    await attendantRepository.markRead(actor.id, keys, now);
  },

  markAllNoticesRead: async (actor: Actor, now: Date = new Date()): Promise<number> => {
    const siteId = await requireHubReader(actor);
    const unread = (await loadNotices(actor, siteId, now)).filter((n) => n.unread).map((n) => n.key);
    await attendantRepository.markRead(actor.id, unread, now);
    return unread.length;
  },
};
