import { Prisma } from '@prisma/client';
import { prisma } from '../../../../config/database';

type Tx = Prisma.TransactionClient;

export const p9Repository = {
  confirmation: (companyId: string, layoutVersion: number) => prisma.p9FormatConfirmation.findUnique({ where: { companyId_layoutVersion: { companyId, layoutVersion } } }),

  /** True when this call made the confirmation; false when the layout was already confirmed (two taps, or a second Accountant). */
  async confirm(tx: Tx, data: { companyId: string; layoutVersion: number; confirmedById: string }): Promise<boolean> {
    const result = await tx.p9FormatConfirmation.createMany({ data: [data], skipDuplicates: true });
    return result.count === 1;
  },

  document: (employeeId: string, year: number, layoutVersion: number) => prisma.p9Document.findUnique({ where: { employeeId_year_layoutVersion: { employeeId, year, layoutVersion } } }),

  /** One builder at a time per person and year, so two requests make one card (the loser finds the winner's under the lock). */
  async lockCard(tx: Tx, employeeId: string, year: number): Promise<void> {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`p9:${employeeId}:${year}`}))`);
  },
  documentIn: (tx: Tx, employeeId: string, year: number, layoutVersion: number) => tx.p9Document.findUnique({ where: { employeeId_year_layoutVersion: { employeeId, year, layoutVersion } } }),
  create: (tx: Tx, data: { companyId: string; employeeId: string; year: number; layoutVersion: number; number: string; bytes: Buffer; hash: string; data: Prisma.InputJsonValue; generatedById: string; generatedAt: Date }) =>
    tx.p9Document.create({ data: { ...data, bytes: new Uint8Array(data.bytes) } }),
};
