import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';
import { locationRepository } from '../../../../repositories/location-repository';
import { NotFoundError } from '../../../../utils/errors';
import { requireHubActor } from '../../_shared/central-store-access';
import { referenceCounterRepository } from '../../_shared/reference-counter';
import { postStockMovement } from '../../stock/ledger/ledger-door';
import { hasPackKey, matchSupplierLine } from '../../suppliers/supplier-line-key';
import { supplierItemRepository } from '../../suppliers/supplier-repository';
import { costPerUsageUnit, deliveredTotal, lineResultOf, notSuppliedTotal, usageQty } from '../_shared/money';
import { canMove } from '../_shared/order-state';
import type { OrderRecord } from '../_shared/order-record';
import { viewOrder } from '../_shared/order-view';
import { purchasingPin } from '../_shared/pin';
import { kes, purchasingAudit } from '../_shared/purchasing-audit';
import { purchasingError, wrongStateError } from '../_shared/purchasing-errors';
import type { OrderView } from '../_shared/purchasing.types';
import { purchaseFileService } from '../files/files-service';
import { ordersRepository } from '../orders/orders-repository';
import { receivingRepository } from './receiving-repository';
import type { ReceiveInput } from './receiving-validators';

type Actor = NonNullable<Request['user']>;

const D = (v: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(v);

interface Counted {
  line: OrderRecord['lines'][number];
  received: Prisma.Decimal;
  /** The price the receiver read on the supplier's note, only when it differs from the order's. */
  changedPrice: Prisma.Decimal | null;
  confirmed: boolean;
}

export const receivingService = {
  /**
   * Record the delivery against an approved or sent order: one signed receipt (GRN), one stock movement per received line, the
   * supplier's last price and the item's cost follow the confirmed price. A short delivery drops the missing quantity (Q-03).
   */
  receive: async (actor: Actor, orderId: string, input: ReceiveInput, now: Date = new Date()): Promise<OrderView> => {
    const siteId = await requireHubActor(actor);
    const order = await ordersRepository.findOrder(siteId, orderId);
    if (!order) throw purchasingError('ORDER_NOT_FOUND', 'That order does not exist.');
    if (!canMove(order.status, 'receive')) throw wrongStateError(order.status);

    const noteNo = input.deliveryNoteNo.trim();
    if (!noteNo || !input.deliveryNotePhotoId) throw purchasingError('DELIVERY_NOTE_REQUIRED', 'Add the delivery note number and a photo of it.');
    const photo = await purchaseFileService.resolve(siteId, input.deliveryNotePhotoId);

    const counted: Counted[] = order.lines.map((line) => {
      const got = input.lines.find((l) => l.lineId === line.id);
      const received = got ? D(got.receivedQty) : line.orderedQty;
      if (received.gt(line.orderedQty)) throw purchasingError('RECEIVED_EXCEEDS_ORDERED', 'You cannot receive more than was ordered.', { lineId: line.id });
      const typed = got?.deliveredPrice ? D(got.deliveredPrice) : null;
      const changedPrice = typed && !typed.equals(line.unitPrice) ? typed : null;
      return { line, received, changedPrice, confirmed: got?.priceConfirmed ?? false };
    });
    if (input.lines.some((l) => !order.lines.some((o) => o.id === l.lineId))) throw purchasingError('VALIDATION', 'A line does not belong to this order.');
    if (counted.every((c) => c.received.isZero())) throw purchasingError('VALIDATION', 'Nothing was received. Cancel the order instead.');
    const unconfirmed = counted.filter((c) => c.received.gt(0) && c.changedPrice && !c.confirmed).map((c) => c.line.id);
    if (unconfirmed.length) throw purchasingError('PRICE_CHANGE_UNCONFIRMED', 'Confirm the price change before you sign.', { lineIds: unconfirmed });

    const holder = await purchasingPin.verifyOwn(actor, input.pin);
    const centralStore = await locationRepository.findCentralStore();
    if (!centralStore || centralStore.siteId !== siteId) throw new NotFoundError('No Central Store is configured for this organization');

    const settled = counted.map((c) => {
      const changed = c.received.gt(0) && c.changedPrice !== null;
      const confirmedPrice = changed ? (c.changedPrice as Prisma.Decimal) : c.line.unitPrice;
      return { ...c, changed, confirmedPrice, result: lineResultOf(c.line.orderedQty, c.received, changed) };
    });
    const priced = settled.map((s) => ({ orderedQty: s.line.orderedQty, unitPrice: s.line.unitPrice, receivedQty: s.received, confirmedPrice: s.confirmedPrice }));
    const delivered = deliveredTotal(priced);
    const missing = notSuppliedTotal(priced);
    const shortCount = settled.filter((s) => s.result === 'SHORT' || s.result === 'NOT_SUPPLIED').length;

    await prisma.$transaction(async (tx) => {
      const moved = await ordersRepository.transition(tx, siteId, order.id, { from: ['APPROVED', 'SENT'], status: 'DELIVERED' });
      if (!moved) throw wrongStateError('changed by someone else');
      const reference = await referenceCounterRepository.nextReference(tx, siteId, 'GRN');
      const received = settled.filter((s) => s.received.gt(0));
      const delivery = await receivingRepository.createDelivery(tx, {
        siteId,
        orderId: order.id,
        reference,
        locationId: centralStore.id,
        deliveryNoteNo: noteNo,
        deliveryNoteFileId: photo?.id ?? null,
        receivedById: actor.id,
        receivedAt: now,
        deliveredTotal: delivered,
        notSuppliedTotal: missing,
        lines: received.map((s, i) => ({
          orderLineId: s.line.id,
          inventoryItemId: s.line.inventoryItemId,
          quantityBuyUnit: s.received,
          quantityUsageUnit: usageQty(s.received, s.line.packSize),
          unitPrice: s.confirmedPrice,
          lineOrder: i + 1,
        })),
      });

      for (const s of settled) {
        await receivingRepository.recordLineReceipt(tx, order.id, s.line.id, {
          receivedQty: s.received,
          deliveredPrice: s.changed ? s.confirmedPrice : null,
          confirmedPrice: s.confirmedPrice,
          result: s.result,
        });
        if (s.received.isZero()) continue;
        const cost = costPerUsageUnit(s.confirmedPrice, s.line.packSize);
        await postStockMovement(tx, {
          type: 'RECEIVE',
          locationId: centralStore.id,
          inventoryItemId: s.line.inventoryItemId,
          quantity: usageQty(s.received, s.line.packSize),
          unitCost: cost,
          userId: actor.id,
          links: { purchaseDeliveryLineId: delivery.lineIds.get(s.line.id) as string },
        });
        await receivingRepository.setItemCost(tx, siteId, s.line.inventoryItemId, cost);
        await recordCatalogPrice(tx, siteId, order, s.line, s.confirmedPrice, now);
      }

      await purchasingAudit.record(
        tx,
        {
          siteId,
          orderId: order.id,
          supplierId: order.supplierId,
          actorId: holder.id,
          action: 'Received goods',
          document: order.reference,
          detail: `${order.lines.length} item${order.lines.length === 1 ? '' : 's'}${shortCount ? `, ${shortCount} short` : ''} · delivered value KES ${kes(delivered)} · ${reference}`,
          what: `received the delivery (${reference}), delivery note ${noteNo}`,
        },
        now,
      );
    });

    const fresh = await ordersRepository.findOrder(siteId, order.id);
    return viewOrder(actor, fresh as OrderRecord, now);
  },
};

/** The supplier's matching pack line takes the confirmed price (a signed receipt wins outright); an item they never sold us gets a line. */
const recordCatalogPrice = async (tx: Prisma.TransactionClient, siteId: string, order: OrderRecord, line: OrderRecord['lines'][number], price: Prisma.Decimal, at: Date): Promise<void> => {
  const current = await supplierItemRepository.listBySupplierItems(order.supplierId, [line.inventoryItemId], siteId, tx);
  const key = { buyUnit: line.buyUnit, packSize: line.packSize };
  const match = matchSupplierLine(current, key) ?? (hasPackKey(key) ? null : (current[0] ?? null));
  if (match) {
    await supplierItemRepository.setLinePrice(match.id, siteId, price, at, tx);
  } else if (current.length === 0) {
    await supplierItemRepository.createLine(siteId, order.supplierId, line.inventoryItemId, { buyUnit: line.buyUnit, packSize: line.packSize?.toString() ?? null, lastPrice: price, lastPriceAt: at }, tx);
  }
};
