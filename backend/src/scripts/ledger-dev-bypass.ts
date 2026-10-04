import type { Prisma } from '@prisma/client';

/**
 * Dev seed scripts reset their fixture data by deleting ledger rows, which the database refuses
 * (migration 20261004120000_ledger_append_only_trigger). Call this first inside the script's
 * `$transaction` to lift that lock until the transaction ends. Dev fixtures only: never from app code
 * (ledger-guard.test.ts fails if the setting appears outside src/scripts).
 */
export const allowLedgerEditsInThisTransaction = async (tx: Prisma.TransactionClient): Promise<void> => {
  await tx.$executeRaw`SELECT set_config('wendo.allow_ledger_edit', 'on', true)`;
};
