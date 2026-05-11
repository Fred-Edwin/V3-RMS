import { PaymentMethod } from '@prisma/client';
import { prisma } from '../config/database';
import type { SplitPaymentLineRecord } from '../types/order.types';

function serialize(
  line: {
    id: string;
    orderId: string;
    label: string;
    amount: { toString(): string };
    method: PaymentMethod;
    mpesaCode: string | null;
    paidAt: Date;
    createdAt: Date;
  },
): SplitPaymentLineRecord {
  return {
    id: line.id,
    orderId: line.orderId,
    label: line.label,
    amount: line.amount.toString(),
    method: line.method,
    mpesaCode: line.mpesaCode,
    paidAt: line.paidAt,
    createdAt: line.createdAt,
  };
}

export const splitLineRepository = {
  create: async (data: {
    orderId: string;
    label: string;
    amount: number;
    method: PaymentMethod;
    mpesaCode?: string;
  }): Promise<SplitPaymentLineRecord> => {
    const line = await prisma.splitPaymentLine.create({
      data: {
        orderId: data.orderId,
        label: data.label,
        amount: data.amount,
        method: data.method,
        mpesaCode: data.mpesaCode ?? null,
      },
    });
    return serialize(line);
  },

  findByOrderId: async (orderId: string): Promise<SplitPaymentLineRecord[]> => {
    const lines = await prisma.splitPaymentLine.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    return lines.map(serialize);
  },

  findById: async (id: string): Promise<SplitPaymentLineRecord | null> => {
    const line = await prisma.splitPaymentLine.findUnique({ where: { id } });
    return line ? serialize(line) : null;
  },

  deleteById: async (id: string): Promise<void> => {
    await prisma.splitPaymentLine.delete({ where: { id } });
  },

  sumByOrderId: async (orderId: string): Promise<number> => {
    const result = await prisma.splitPaymentLine.aggregate({
      where: { orderId },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  },
};
