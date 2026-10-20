import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

export type DocumentVariant = 'ORIGINAL' | 'REPLACED';

/** Stored A4 payslips. Insert-only (database trigger): the first file made for a version is the file every download gets (PD16). */
export const documentsRepository = {
  find: (payslipId: string, variant: DocumentVariant) => prisma.payslipDocument.findUnique({ where: { payslipId_variant: { payslipId, variant } } }),

  /** Stores the file. When two requests render at once the second loses the race and gets the first one's file. */
  async store(data: { payslipId: string; variant: DocumentVariant; number: string; bytes: Buffer; hash: string }) {
    try {
      return await prisma.payslipDocument.create({ data: { ...data, bytes: new Uint8Array(data.bytes) } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await prisma.payslipDocument.findUnique({ where: { payslipId_variant: { payslipId: data.payslipId, variant: data.variant } } });
        if (winner) return winner;
      }
      throw error;
    }
  },
};
