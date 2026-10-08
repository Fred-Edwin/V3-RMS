/**
 * Makes opt-in database test files take turns on the one database.
 *
 * Several `*.db.test.ts` files build rows in the same database, and some read the whole of it (the migration back-fill checks in
 * `requisitions.db.test.ts` scan every requisition and branch). Run together, one file saw the other's half-built rows and failed.
 * A file that needs the database to itself calls this in a top-level `beforeAll` and the returned function in `afterAll`:
 *
 *   let release: () => Promise<void>;
 *   beforeAll(async () => { release = await takeDbTestLock(); }, LOCK_WAIT_MS);
 *   afterAll(async () => { await release(); });
 *
 * The lock is a Postgres advisory lock held by an open transaction on its own one-connection client, so it works across worker
 * processes, shards and runners alike, and lets go on its own if the process dies. It is only for tests: nothing imports it
 * at run time.
 */
import { PrismaClient } from '@prisma/client';

/** Any number, the same in every file that wants the lock. */
const LOCK_KEY = 727_104_001;
/** How long a file may wait for the others to finish (a `beforeAll` timeout). */
export const LOCK_WAIT_MS = 180_000;

function oneConnectionUrl(): string {
  const url = new URL(process.env['DATABASE_URL'] ?? '');
  url.searchParams.set('connection_limit', '1');
  url.searchParams.set('pool_timeout', '0');
  return url.toString();
}

export async function takeDbTestLock(): Promise<() => Promise<void>> {
  const client = new PrismaClient({ datasourceUrl: oneConnectionUrl() });
  let letGo: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    letGo = resolve;
  });
  let gotIt: () => void = () => undefined;
  const acquired = new Promise<void>((resolve) => {
    gotIt = resolve;
  });
  const transaction = client.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})`;
      gotIt();
      await held;
    },
    { maxWait: LOCK_WAIT_MS, timeout: LOCK_WAIT_MS * 3 },
  );
  // A failure after the lock is held is reported by the release function; this keeps it from surfacing earlier as unhandled.
  transaction.catch(() => undefined);
  // If the transaction fails before it holds the lock, surface that error instead of waiting for ever.
  await Promise.race([acquired, transaction]);
  return async () => {
    letGo();
    await transaction;
    await client.$disconnect();
  };
}
