import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { ForbiddenError } from '../../../../utils/errors';
import { blindnessOf } from '../../_shared/blind-rule';
import { actorCan, requireHubActor, requireHubReader } from '../../_shared/central-store-access';
import { referenceCounterRepository } from '../../_shared/reference-counter';
import { orderedTotal, toMoney, toQty } from '../_shared/money';
import { ORDER_STATUSES, canMove, stageOf, type OrderStatus, type SendVia } from '../_shared/order-state';
import type { OrderRecord } from '../_shared/order-record';
import { cancelWord, roleLabel, termsDaysOf, viewFile, viewOrder, viewRow } from '../_shared/order-view';
import { purchasingPin } from '../_shared/pin';
import { kes, purchasingAudit } from '../_shared/purchasing-audit';
import { purchasingError, wrongStateError } from '../_shared/purchasing-errors';
import type { OrderRowView, PurchaseFileView, OrderView } from '../_shared/purchasing.types';
import { needsRestockingService } from '../needs-restocking/needs-restocking-service';
import { packOf } from '../needs-restocking/needs-restocking-logic';
import { ordersRepository, type NewLine, type OrderSupplier, type Transition } from './orders-repository';
import type { CancelInput, OrderInput, OrdersQuery, UpdateOrderInput } from './orders-validators';
import type { LpoPrint, OrdersList, OrdersSummary, WhatsappMessage } from './orders.types';

type Actor = NonNullable<Request['user']>;
type InputLine = OrderInput['lines'][number];

const LIST_LIMIT = 500;
const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);
const day = (d: Date): string => d.toISOString().slice(0, 10);
const plural = (n: number): string => `${n} item${n === 1 ? '' : 's'}`;

const forbidden = (): ForbiddenError => new ForbiddenError('You do not have permission to perform this action');

const load = async (siteId: string, id: string): Promise<OrderRecord> => {
  const order = await ordersRepository.findOrder(siteId, id);
  if (!order) throw purchasingError('ORDER_NOT_FOUND', 'That order does not exist.');
  return order;
};

const totalOf = (o: OrderRecord): Prisma.Decimal => orderedTotal(o.lines.map((l) => ({ orderedQty: l.orderedQty, unitPrice: l.unitPrice })));

const assertSupplierOrderable = (supplier: OrderSupplier | null): OrderSupplier => {
  if (!supplier || supplier.deletedAt || supplier.status === 'ARCHIVED') throw purchasingError('SUPPLIER_NOT_FOUND', 'That supplier does not exist.');
  if (supplier.status === 'ON_HOLD') throw purchasingError('SUPPLIER_ON_HOLD', `${supplier.name} is on hold.`);
  return supplier;
};

/** One supplier line per item may exist for several packs: the preferred one, else a priced one, else the newest. */
const bestLine = <T extends { isPreferred: boolean; lastPrice: Prisma.Decimal | null; lastPriceAt: Date | null }>(lines: readonly T[]): T | undefined =>
  [...lines].sort(
    (a, b) => Number(b.isPreferred) - Number(a.isPreferred) || Number(b.lastPrice !== null) - Number(a.lastPrice !== null) || (b.lastPriceAt?.getTime() ?? 0) - (a.lastPriceAt?.getTime() ?? 0),
  )[0];

/**
 * Turn the requested lines into stored ones. An item is orderable when the supplier sells it with a price, or when a person who
 * approves orders types one; otherwise `ITEM_SETUP_INCOMPLETE` (owner may overrule this rule, see purchasing-plan.md).
 */
const buildLines = async (actor: Actor, siteId: string, supplierId: string, input: readonly InputLine[]): Promise<NewLine[]> => {
  const ids = input.map((l) => l.inventoryItemId);
  if (new Set(ids).size !== ids.length) throw purchasingError('VALIDATION', 'An item is on the order twice. Change its quantity instead.');
  const [items, supplierLines, previous] = await Promise.all([
    ordersRepository.findItems(siteId, ids),
    ordersRepository.findSupplierLines(siteId, supplierId, ids),
    ordersRepository.findPreviousPrices(siteId, supplierId, ids),
  ]);
  const mayType = actorCan(actor, 'orders.approve');
  return input.map((l, index) => {
    const item = items.find((i) => i.id === l.inventoryItemId);
    if (!item) throw purchasingError('VALIDATION', 'One of the items does not exist.');
    const qty = D(l.qty);
    if (!qty.gt(0)) throw purchasingError('VALIDATION', 'Quantities must be more than zero.', { inventoryItemId: item.id });
    const line = bestLine(supplierLines.filter((s) => s.inventoryItemId === item.id));
    const typed = mayType && l.unitPrice !== '' ? D(l.unitPrice) : null;
    const price = typed ?? line?.lastPrice ?? null;
    if (price === null) throw purchasingError('ITEM_SETUP_INCOMPLETE', `${item.name} is not set up yet, so it cannot be ordered.`, { inventoryItemId: item.id });
    return {
      lineOrder: index + 1,
      inventoryItemId: item.id,
      supplierItemName: line?.supplierItemName ?? null,
      supplierItemCode: line?.supplierItemCode ?? null,
      buyUnit: line?.buyUnit ?? item.buyUnit,
      packSize: line ? packOf({ buyUnit: line.buyUnit, packSize: line.packSize }, item) : item.packSize,
      orderedQty: qty,
      unitPrice: price,
      previousPrice: previous.get(item.id) ?? null,
    };
  });
};

const newLinesTotal = (lines: readonly NewLine[]): Prisma.Decimal => orderedTotal(lines.map((l) => ({ orderedQty: l.orderedQty, unitPrice: l.unitPrice })));

const isUniqueViolation = (error: unknown): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const moveOrThrow = async (tx: Prisma.TransactionClient, siteId: string, o: OrderRecord, transition: Transition): Promise<void> => {
  if (!(await ordersRepository.transition(tx, siteId, o.id, transition))) throw wrongStateError('changed by someone else');
};

const dateOrNull = (iso: string | null | undefined): Date | null => (iso ? new Date(`${iso}T00:00:00Z`) : null);

export const ordersService = {
  // ------------------------------------------------------------------ reads

  /** Tab counts for the Purchasing header. Every caller who may read orders sees every order (owner decision 2). */
  getSummary: async (actor: Actor, now: Date = new Date()): Promise<OrdersSummary> => {
    const siteId = await requireHubReader(actor);
    const [byStatus, awaitingLines, dueToReceiveCount, needs] = await Promise.all([
      ordersRepository.countByStatus(siteId),
      ordersRepository.findAwaitingApprovalLines(siteId),
      ordersRepository.countDueToReceive(siteId, new Date(`${day(now)}T00:00:00Z`)),
      needsRestockingService.countNeeds(actor),
    ]);
    const inStage = (stage: ReturnType<typeof stageOf>): number => byStatus.filter((r) => stageOf(r.status) === stage).reduce((t, r) => t + r.count, 0);
    return {
      counts: { needs, approval: inStage('APPROVAL'), receive: inStage('RECEIVE'), invoice: inStage('INVOICE'), pay: inStage('PAY'), closed: inStage('CLOSED') },
      awaitingApprovalValue: blindnessOf(actor).itemCosts ? '' : toMoney(orderedTotal(awaitingLines)),
      dueToReceiveCount,
    };
  },

  list: async (actor: Actor, query: OrdersQuery, now: Date = new Date()): Promise<OrdersList> => {
    const siteId = await requireHubReader(actor);
    const statuses: readonly OrderStatus[] | undefined = query.status ? [query.status] : query.stage ? ORDER_STATUSES.filter((s) => stageOf(s) === query.stage) : undefined;
    // "Needs restocking" is not a list of orders: it has its own endpoint.
    if (query.stage === 'NEEDS') return { orders: [], total: 0, valueTotal: toMoney(0) };
    const rows = await ordersRepository.list(siteId, { statuses, supplierId: query.supplierId, raisedById: query.raisedBy, q: query.q }, LIST_LIMIT);
    const sorted = [...rows].sort((a, b) => (b.submittedAt ?? b.createdAt).getTime() - (a.submittedAt ?? a.createdAt).getTime());
    const orders: OrderRowView[] = sorted.map((o) => viewRow(actor, o, now));
    const valueTotal = blindnessOf(actor).itemCosts ? '' : toMoney(sorted.reduce((t, o) => t.plus(totalOf(o)), D(0)));
    return { orders, total: orders.length, valueTotal };
  },

  getOne: async (actor: Actor, id: string, now: Date = new Date()): Promise<PurchaseFileView> => {
    const siteId = await requireHubReader(actor);
    return viewFile(actor, await load(siteId, id), now);
  },

  /** The printed order for the supplier: what to bring and how many. No prices, no total, no amount in words. */
  getLpoPrint: async (actor: Actor, id: string, now: Date = new Date()): Promise<LpoPrint> => {
    const siteId = await requireHubReader(actor);
    const o = await load(siteId, id);
    const contact = o.supplier.contacts[0];
    const terms = o.termsDays;
    return {
      reference: o.reference ?? 'DRAFT',
      date: day(o.submittedAt ?? o.createdAt),
      supplier: { name: o.supplier.name, address: o.supplier.address, contact: contact?.name ?? null, phone: contact?.whatsapp ?? contact?.phone ?? null },
      expectedDate: o.expectedDate ? day(o.expectedDate) : null,
      termsLabel: terms ? `Invoice, ${terms} days` : 'Cash on delivery',
      deliverTo: 'Wendo Central Store',
      raisedByName: o.raisedBy.name,
      lines: o.lines.map((l, i) => ({
        n: i + 1,
        supplierItemName: l.supplierItemName ?? l.inventoryItem.name.toUpperCase(),
        supplierItemCode: l.supplierItemCode,
        ourItemName: l.inventoryItem.name,
        qty: toQty(l.orderedQty),
        unit: l.buyUnit,
      })),
      note: o.supplierNote,
      raisedBy: { name: o.raisedBy.name, role: roleLabel(o.raisedBy.role), signedAt: (o.submittedAt ?? o.createdAt).toISOString() },
      authorisedBy: o.approvedBy && o.approvedAt ? { name: o.approvedBy.name, role: roleLabel(o.approvedBy.role), signedAt: o.approvedAt.toISOString() } : null,
      generatedAt: now.toISOString(),
    };
  },

  getWhatsapp: async (actor: Actor, id: string): Promise<WhatsappMessage> => {
    const siteId = await requireHubReader(actor);
    const o = await load(siteId, id);
    const contact = o.supplier.contacts[0];
    const phone = contact?.whatsapp ?? contact?.phone ?? null;
    const first = (contact?.name ?? 'there').split(' ')[0];
    const when = o.expectedDate ? ` for delivery on ${o.expectedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}` : '';
    return {
      to: `${contact?.name ?? o.supplier.name} · ${o.supplier.name}${phone ? ` · ${phone}` : ''}`,
      phone,
      message: `Hello ${first}, please find attached our local purchase order ${o.reference}${when}. Please confirm receipt and quote ${o.reference} on your delivery note. Thank you, Wendo Coffee Bistro.`,
      pdfFileName: `${o.reference}.pdf`,
      pdfSizeLabel: 'ready',
    };
  },

  // ------------------------------------------------------------------ writes

  create: async (actor: Actor, input: OrderInput, now: Date = new Date()): Promise<OrderView> => {
    const siteId = await requireHubActor(actor);
    const supplier = assertSupplierOrderable(await ordersRepository.findSupplier(siteId, input.supplierId));
    const open = await ordersRepository.findOpenOrder(siteId, supplier.id);
    if (open) throw purchasingError('SUPPLIER_ORDER_OPEN', `${open.reference ?? 'A draft'} to ${supplier.name} is still open.`, { openOrderId: open.id, openReference: open.reference });
    const lines = await buildLines(actor, siteId, supplier.id, input.lines);
    try {
      const id = await prisma.$transaction(async (tx) => {
        const orderId = await ordersRepository.create(tx, {
          siteId,
          supplierId: supplier.id,
          termsDays: termsDaysOf(supplier),
          expectedDate: dateOrNull(input.expectedDate),
          supplierNote: input.supplierNote,
          attendantNote: input.attendantNote,
          raisedById: actor.id,
          lines,
        });
        await purchasingAudit.record(
          tx,
          { siteId, orderId, supplierId: supplier.id, actorId: actor.id, action: 'Saved draft order', document: null, detail: `${supplier.name} · ${plural(lines.length)}`, what: 'saved a draft' },
          now,
        );
        return orderId;
      });
      return viewOrder(actor, await load(siteId, id), now);
    } catch (error) {
      // The database also holds the one-open-order rule, for two people saving at the same moment.
      if (isUniqueViolation(error)) throw purchasingError('SUPPLIER_ORDER_OPEN', `A draft to ${supplier.name} is still open.`);
      throw error;
    }
  },

  update: async (actor: Actor, id: string, input: UpdateOrderInput, now: Date = new Date()): Promise<OrderView> => {
    const siteId = await requireHubActor(actor);
    const o = await load(siteId, id);
    if (!viewOrder(actor, o, now).can.edit) {
      if (!canMove(o.status, 'edit')) throw wrongStateError(o.status);
      throw forbidden();
    }
    const lines = input.lines ? await buildLines(actor, siteId, o.supplierId, input.lines) : null;
    await prisma.$transaction(async (tx) => {
      if (lines) await ordersRepository.replaceLines(tx, o.id, lines);
      await ordersRepository.updateDetails(tx, siteId, o.id, {
        ...(input.expectedDate !== undefined ? { expectedDate: dateOrNull(input.expectedDate) } : {}),
        ...(input.supplierNote !== undefined ? { supplierNote: input.supplierNote } : {}),
        ...(input.attendantNote !== undefined ? { attendantNote: input.attendantNote } : {}),
      });
      const count = lines ? lines.length : o.lines.length;
      const total = lines ? newLinesTotal(lines) : totalOf(o);
      await purchasingAudit.record(
        tx,
        { siteId, orderId: o.id, supplierId: o.supplierId, actorId: actor.id, action: 'Edited order', document: o.reference, detail: `${plural(count)} · KES ${kes(total)}`, what: 'edited the order' },
        now,
      );
    });
    return viewOrder(actor, await load(siteId, id), now);
  },

  /** Throw away a draft: it has no number and nothing went out. */
  discard: async (actor: Actor, id: string): Promise<void> => {
    const siteId = await requireHubActor(actor);
    const o = await load(siteId, id);
    if (o.status !== 'DRAFT') throw wrongStateError(o.status);
    if (o.raisedById !== actor.id && !actorCan(actor, 'orders.approve')) throw forbidden();
    await prisma.$transaction(async (tx) => {
      if (!(await ordersRepository.deleteDraft(tx, siteId, o.id))) throw wrongStateError('changed by someone else');
    });
  },

  submit: async (actor: Actor, id: string, now: Date = new Date()): Promise<OrderView> => {
    const siteId = await requireHubActor(actor);
    const o = await load(siteId, id);
    if (!canMove(o.status, 'submit')) throw wrongStateError(o.status);
    if (!viewOrder(actor, o, now).can.submit) throw forbidden();
    assertSupplierOrderable(await ordersRepository.findSupplier(siteId, o.supplierId));
    await prisma.$transaction(async (tx) => {
      const reference = o.reference ?? (await referenceCounterRepository.nextReference(tx, siteId, 'LPO'));
      await moveOrThrow(tx, siteId, o, { from: ['DRAFT', 'RETURNED'], status: 'AWAITING_APPROVAL', reference, submittedAt: now, returnedNote: null, returnedById: null, returnedAt: null });
      await purchasingAudit.record(
        tx,
        { siteId, orderId: o.id, supplierId: o.supplierId, actorId: actor.id, action: 'Raised order', document: reference, detail: `To ${o.supplier.name} · KES ${kes(totalOf(o))} · sent for approval`, what: 'sent the order for approval' },
        now,
      );
    });
    return viewOrder(actor, await load(siteId, id), now);
  },

  /** Approve with the approver's own PIN. A draft is approved straight away when an approver raised it themselves. */
  approve: async (actor: Actor, id: string, pin: string, now: Date = new Date()): Promise<OrderView> => {
    const siteId = await requireHubActor(actor);
    const o = await load(siteId, id);
    if (!canMove(o.status, 'approve')) throw wrongStateError(o.status);
    await purchasingPin.verifyOwn(actor, pin);
    await prisma.$transaction(async (tx) => {
      const reference = o.reference ?? (await referenceCounterRepository.nextReference(tx, siteId, 'LPO'));
      await moveOrThrow(tx, siteId, o, { from: ['AWAITING_APPROVAL', 'DRAFT'], status: 'APPROVED', reference, submittedAt: o.submittedAt ?? now, approvedById: actor.id, approvedAt: now });
      await purchasingAudit.record(
        tx,
        { siteId, orderId: o.id, supplierId: o.supplierId, actorId: actor.id, action: 'Approved order', document: reference, detail: `To ${o.supplier.name} · KES ${kes(totalOf(o))} · signed with PIN`, what: 'approved the order with a PIN' },
        now,
      );
    });
    return viewOrder(actor, await load(siteId, id), now);
  },

  returnOrder: async (actor: Actor, id: string, note: string, now: Date = new Date()): Promise<OrderView> => {
    const siteId = await requireHubActor(actor);
    const o = await load(siteId, id);
    if (!canMove(o.status, 'return')) throw wrongStateError(o.status);
    const reason = note.trim();
    if (!reason) throw purchasingError('REASON_REQUIRED', 'Say why you are sending it back.');
    await prisma.$transaction(async (tx) => {
      await moveOrThrow(tx, siteId, o, { from: ['AWAITING_APPROVAL'], status: 'RETURNED', returnedNote: reason, returnedById: actor.id, returnedAt: now });
      await purchasingAudit.record(
        tx,
        { siteId, orderId: o.id, supplierId: o.supplierId, actorId: actor.id, action: 'Returned order', document: o.reference, detail: reason, what: `returned the order: ${reason}` },
        now,
      );
    });
    return viewOrder(actor, await load(siteId, id), now);
  },

  /** Mark the approved order as sent. A second send changes nothing. */
  send: async (actor: Actor, id: string, via: SendVia, now: Date = new Date()): Promise<OrderView> => {
    const siteId = await requireHubActor(actor);
    const o = await load(siteId, id);
    if (!canMove(o.status, 'send')) throw wrongStateError(o.status);
    if (o.status === 'APPROVED') {
      const contact = o.supplier.contacts[0];
      const action = via === 'WHATSAPP' ? 'Sent order on WhatsApp' : via === 'MANUAL' ? 'Marked order as sent' : via === 'PRINT' ? 'Printed order' : 'Copied order link';
      const phone = contact?.whatsapp ?? contact?.phone;
      const detail =
        via === 'WHATSAPP' ? `To ${contact?.name ?? o.supplier.name}${phone ? `, ${phone}` : ''}` : via === 'MANUAL' ? `Phoned in to ${o.supplier.name}` : `For ${o.supplier.name}`;
      await prisma.$transaction(async (tx) => {
        await moveOrThrow(tx, siteId, o, { from: ['APPROVED'], status: 'SENT', sentAt: now, sentVia: via, sentById: actor.id });
        await purchasingAudit.record(
          tx,
          { siteId, orderId: o.id, supplierId: o.supplierId, actorId: actor.id, action, document: o.reference, detail, what: via === 'MANUAL' ? 'marked the order as sent' : `sent the order (${via.toLowerCase()})` },
          now,
        );
      });
    }
    return viewOrder(actor, await load(siteId, id), now);
  },

  /** Cancel before anything arrives, with a reason and the caller's PIN. After delivery the order cannot be cancelled. */
  cancel: async (actor: Actor, id: string, input: CancelInput, now: Date = new Date()): Promise<OrderView> => {
    const siteId = await requireHubActor(actor);
    const o = await load(siteId, id);
    if (o.delivery || o.status === 'DELIVERED' || o.status === 'INVOICED' || o.status === 'CLOSED') {
      throw purchasingError('CANNOT_CANCEL_AFTER_DELIVERY', "Once goods have arrived an order can't be cancelled.");
    }
    if (!canMove(o.status, 'cancel')) throw wrongStateError(o.status);
    await purchasingPin.verifyOwn(actor, input.pin);
    await prisma.$transaction(async (tx) => {
      await moveOrThrow(tx, siteId, o, { from: ['AWAITING_APPROVAL', 'RETURNED', 'APPROVED', 'SENT'], status: 'CANCELLED', cancelReason: input.reason, cancelNote: input.note, cancelledById: actor.id, cancelledAt: now });
      await purchasingAudit.record(
        tx,
        {
          siteId,
          orderId: o.id,
          supplierId: o.supplierId,
          actorId: actor.id,
          action: 'Cancelled order',
          document: o.reference,
          detail: `${cancelWord(input.reason)} · KES ${kes(totalOf(o))}${input.note ? ` · ${input.note}` : ''}`,
          what: 'cancelled the order',
        },
        now,
      );
    });
    return viewOrder(actor, await load(siteId, id), now);
  },
};
