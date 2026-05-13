import { OrderStatus, PaymentMethod } from '@prisma/client';
import { orderRepository } from '../repositories/order-repository';
import { splitLineRepository } from '../repositories/split-line-repository';
import type { SplitPaymentLineRecord } from '../types/order.types';
import type { AddSplitLineInput } from '../validators/order-schemas';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import type { Request } from 'express';

type Actor = NonNullable<Request['user']>;

function resolveOrgId(actor: Actor): string {
  if ('organizationId' in actor && actor.organizationId) return actor.organizationId as string;
  throw new ForbiddenError('Cannot resolve organization from actor');
}

const ALLOWED_LINE_METHODS: PaymentMethod[] = [
  PaymentMethod.MPESA,
  PaymentMethod.CASH,
  PaymentMethod.CARD,
];

export const splitLineService = {
  addLine: async (
    orderId: string,
    data: AddSplitLineInput,
    actor: Actor,
  ): Promise<SplitPaymentLineRecord> => {
    const organizationId = resolveOrgId(actor);
    const order = await orderRepository.findById(orderId, organizationId);
    if (!order) throw new NotFoundError('Order not found');

    if (
      order.status === OrderStatus.CLOSED ||
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.AWAITING_CANCELLATION_APPROVAL
    ) {
      throw new ConflictError('Cannot add a payment line to a locked, closed, or cancelled order');
    }

    if (!ALLOWED_LINE_METHODS.includes(data.method as PaymentMethod)) {
      throw new ValidationError('Line method must be MPESA, CASH, or CARD');
    }

    const orderTotal = Number(order.total);
    const existingSum = await splitLineRepository.sumByOrderId(orderId);
    const newSum = existingSum + data.amount;

    if (newSum > orderTotal + 1) {
      throw new ConflictError(
        `Adding KES ${data.amount} would exceed the order total of KES ${orderTotal.toFixed(2)}`,
      );
    }

    return splitLineRepository.create({
      orderId,
      label: data.label,
      amount: data.amount,
      method: data.method as PaymentMethod,
      mpesaCode: data.mpesaCode,
    });
  },

  getLines: async (orderId: string, actor: Actor): Promise<SplitPaymentLineRecord[]> => {
    const organizationId = resolveOrgId(actor);
    const order = await orderRepository.findById(orderId, organizationId);
    if (!order) throw new NotFoundError('Order not found');
    return splitLineRepository.findByOrderId(orderId);
  },

  removeLine: async (orderId: string, lineId: string, actor: Actor): Promise<void> => {
    const organizationId = resolveOrgId(actor);
    const order = await orderRepository.findById(orderId, organizationId);
    if (!order) throw new NotFoundError('Order not found');

    if (
      order.status === OrderStatus.CLOSED ||
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.AWAITING_CANCELLATION_APPROVAL
    ) {
      throw new ConflictError('Cannot remove a payment line from a locked, closed, or cancelled order');
    }

    const line = await splitLineRepository.findById(lineId);
    if (!line || line.orderId !== orderId) throw new NotFoundError('Payment line not found');

    await splitLineRepository.deleteById(lineId);
  },
};
