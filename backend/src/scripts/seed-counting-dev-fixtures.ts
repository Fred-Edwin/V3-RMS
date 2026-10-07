/**
 * seed-counting-dev-fixtures.ts
 *
 * Local dev-only fixtures for the Counting rebuild (docs/features/inventory/stock-count-waste-contract.md), so every screen can be
 * compared with the Paper artboards in the same state:
 *
 *   - Local users for every role the Counting grid names (System Admin, Director, Accountant, Branch Manager, a second Store
 *     Attendant), created only if missing, and a signing PIN of 1234 for the Store Manager, both Attendants and the System Admin.
 *   - An OPEN count by the Store Attendant: some numbers in, one skipped, one zero (section A).
 *   - A SUBMITTED count by the second Attendant, waiting for the Manager: lines inside and outside the range (section B).
 *   - An APPROVED count the Store Manager signed herself, with a line flagged to the Director and its ADJUSTMENTs posted through
 *     the ledger door (section C).
 *   - A repeat shortfall: one item short in three signed counts running.
 *   - An Attendant move (an item taken out of its section into "Others") that the Manager can undo.
 *
 * Every date is computed from "now". Idempotent: it removes the counts it made before (and their ledger rows and its own
 * `dev fixture stock` receipts) and rewrites them. ONLY runs when NODE_ENV is not "production". It makes no migration changes.
 *
 * Usage:
 *   npx tsx src/scripts/seed-counting-dev-fixtures.ts           # seed
 *   npx tsx src/scripts/seed-counting-dev-fixtures.ts --reset   # only remove what this script made
 */

import 'dotenv/config';
import { Prisma, type UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { hashPassword, hashPin } from '../utils/password';
import { judgeLine, shortStreak } from '../modules/inventory/_shared/variance-calc';
import { nextCountReference } from '../modules/inventory/counting/_shared/count-numbers';
import { signedWith, startedWith } from '../modules/inventory/counting/_shared/count-idempotency';
import { settingsInForce } from '../modules/inventory/counting/_shared/count-settings';
import { postStockMovement } from '../modules/inventory/stock/ledger/ledger-door';
import { allowLedgerEditsInThisTransaction } from './ledger-dev-bypass';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-counting-dev-fixtures must not run in production. Exiting.');
  process.exit(1);
}

const KEY_PREFIX = 'dev-fixture-';
const STOCK_REASON = 'dev fixture stock';
const PIN = '1234';
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms);

const reset = async (siteId: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await allowLedgerEditsInThisTransaction(tx);
    const counts = await tx.count.findMany({ where: { siteId, idempotencyKey: { startsWith: KEY_PREFIX } }, select: { id: true } });
    const lines = await tx.countLine.findMany({ where: { countId: { in: counts.map((c) => c.id) } }, select: { id: true } });
    await tx.inventoryTransaction.deleteMany({ where: { OR: [{ countLineId: { in: lines.map((l) => l.id) } }, { siteId, reason: STOCK_REASON }] } });
    await tx.count.deleteMany({ where: { id: { in: counts.map((c) => c.id) } } });
    // Put back the items the Attendant moved (standing moves only) so the move below can be made again.
    const moves = await tx.countItemMove.findMany({ where: { siteId, undoneAt: null, movedBy: { role: 'STORE_ATTENDANT' } }, orderBy: { movedAt: 'desc' } });
    for (const move of moves) {
      if (move.fromSectionId) await tx.countSectionItem.updateMany({ where: { siteId, inventoryItemId: move.inventoryItemId, sectionId: move.toSectionId }, data: { sectionId: move.fromSectionId } });
    }
    await tx.countItemMove.deleteMany({ where: { id: { in: moves.map((m) => m.id) } } });
  });
};

const main = async (): Promise<void> => {
  const hub = await prisma.site.findFirstOrThrow({ where: { isHub: true } });
  const siteId = hub.id;
  await reset(siteId);
  if (process.argv.includes('--reset')) {
    console.log('Removed the counting dev fixtures.');
    return;
  }

  // --- people ---------------------------------------------------------------
  const ensureUser = async (email: string, name: string, role: UserRole, orgId: string | null) =>
    (await prisma.user.findUnique({ where: { email } })) ??
    prisma.user.create({ data: { email, name, role, siteId: orgId, passwordHash: await hashPassword('password123'), isActive: true } });
  const manager = await prisma.user.findFirstOrThrow({ where: { role: 'STORE_MANAGER', siteId } });
  const attendant = await prisma.user.findFirstOrThrow({ where: { role: 'STORE_ATTENDANT', siteId } });
  const peter = await ensureUser('dev.peter.attendant@wendo.test', 'Peter Kariuki', 'STORE_ATTENDANT', siteId);
  await ensureUser('admin@wendo.test', 'System Admin', 'SYSTEM_ADMIN', null);
  await ensureUser('director@wendo.test', 'Grace Wambui', 'DIRECTOR', siteId);
  await ensureUser('accountant@wendo.test', 'Amos Otieno', 'ACCOUNTANT', siteId);
  const branch = await prisma.site.findFirst({ where: { isHub: false, isActive: true } });
  if (branch) await ensureUser('bm.town@wendo.test', 'Beth Mwangi', 'MANAGER', branch.id);
  const pinHash = await hashPin(PIN);
  await prisma.user.updateMany({ where: { id: { in: [manager.id, attendant.id, peter.id] } }, data: { pinHash } });
  await prisma.user.updateMany({ where: { email: 'admin@wendo.test' }, data: { pinHash } });

  // --- items: three sections with at least four items each ---------------------
  const location = await prisma.location.findFirstOrThrow({ where: { siteId, type: 'CENTRAL_STORE' } });
  const sections = await prisma.countSection.findMany({
    where: { siteId, items: { some: {} } },
    orderBy: { position: 'asc' },
    select: { id: true, name: true, items: { where: { inventoryItem: { deletedAt: null } }, orderBy: { position: 'asc' }, take: 6, select: { inventoryItem: { select: { id: true, name: true, currentCost: true } } } } },
  });
  const usable = sections.filter((s) => s.items.length >= 4);
  if (usable.length < 3) throw new Error('Needs three count sections with four or more items: run the migration first.');
  const [secA, secB, secC] = usable as [(typeof usable)[number], (typeof usable)[number], (typeof usable)[number]];
  const itemsOf = (s: (typeof usable)[number]) => s.items.map((i) => i.inventoryItem);

  // Give every item the fixtures touch a known amount on hand (receipts tagged so a re-run removes them).
  const touched = [...itemsOf(secA), ...itemsOf(secB), ...itemsOf(secC)];
  const onHand = new Map<string, Prisma.Decimal>();
  for (const item of touched) {
    const sum = await prisma.inventoryTransaction.aggregate({ where: { siteId, locationId: location.id, inventoryItemId: item.id }, _sum: { quantity: true } });
    let current = sum._sum.quantity ?? D(0);
    if (current.lessThan(40)) {
      await prisma.inventoryTransaction.create({ data: { siteId, locationId: location.id, inventoryItemId: item.id, type: 'RECEIVE', quantity: D(100).minus(current), unitCost: item.currentCost, reason: STOCK_REASON, userId: manager.id } });
      current = D(100);
    }
    onHand.set(item.id, current);
  }
  const settings = settingsInForce(await prisma.countingThresholds.findUnique({ where: { siteId } }));

  type Plan = { item: { id: string; name: string; currentCost: Prisma.Decimal }; counted: number | null; expected?: Prisma.Decimal; recheck?: 'RECOUNTED' | 'KEPT'; first?: number };
  type Made = { id: string; reference: string; lines: { id: string; itemId: string; difference: Prisma.Decimal | null; result: string }[] };

  /** Creates a count and its lines; a signed one gets frozen figures like the real sign makes. */
  const makeCount = async (args: {
    counter: { id: string };
    section: (typeof usable)[number];
    status: 'OPEN' | 'SUBMITTED' | 'APPROVED';
    startedAt: Date;
    signedAt?: Date;
    selfSigned?: boolean;
    plans: Plan[];
    key: string;
    history?: Map<string, Prisma.Decimal[]>;
  }): Promise<Made> =>
    prisma.$transaction(async (tx) => {
      const reference = await nextCountReference(tx, siteId, args.startedAt);
      const signed = args.status !== 'OPEN';
      const count = await tx.count.create({
        data: {
          siteId,
          locationId: location.id,
          reference,
          counterId: args.counter.id,
          status: args.status,
          startedAt: args.startedAt,
          signedAt: args.signedAt ?? null,
          expectedAsOf: args.signedAt ?? null,
          selfSigned: args.selfSigned ?? false,
          approverId: args.status === 'APPROVED' ? manager.id : null,
          approvedAt: args.status === 'APPROVED' ? args.signedAt ?? null : null,
          idempotencyKey: signed ? signedWith(startedWith(`${KEY_PREFIX}${args.key}`), `${KEY_PREFIX}sign-${args.key}`) : startedWith(`${KEY_PREFIX}${args.key}`),
          ...(signed ? { rangeKes: settings.rangeKes, rangePercent: settings.rangePercent, directorAlertKes: settings.directorAlertKes, flagRepeat: settings.flagRepeat } : {}),
          scopeSections: { create: [{ sectionId: args.section.id, sectionName: args.section.name }] },
          updatedAt: args.signedAt ? new Date(args.signedAt.getTime() - 60_000) : args.startedAt,
        },
      });
      const made: Made['lines'] = [];
      for (const [position, plan] of args.plans.entries()) {
        const expected = plan.expected ?? onHand.get(plan.item.id) ?? D(0);
        const counted = plan.counted === null ? null : D(plan.counted);
        const judged = signed ? judgeLine({ counted, expected, unitCost: plan.item.currentCost, rangeKes: settings.rangeKes, rangePercent: settings.rangePercent }) : null;
        const streak = judged?.difference?.isNegative() ? shortStreak([judged.difference, ...(args.history?.get(plan.item.id) ?? [])], settings.flagRepeat) : 0;
        const line = await tx.countLine.create({
          data: {
            siteId,
            countId: count.id,
            inventoryItemId: plan.item.id,
            sectionId: args.section.id,
            sectionName: args.section.name,
            position,
            countedQty: counted,
            skipped: plan.counted === null && position % 2 === 1,
            recheck: plan.recheck ?? 'NONE',
            recheckOffered: plan.recheck !== undefined,
            firstCountedQty: plan.first !== undefined ? D(plan.first) : null,
            isOpen: !signed,
            ...(judged ? { expectedQty: expected, unitCost: plan.item.currentCost, result: judged.result, shortStreak: streak } : {}),
          },
        });
        made.push({ id: line.id, itemId: plan.item.id, difference: judged?.difference ?? null, result: judged?.result ?? 'NOT_YET' });
      }
      return { id: count.id, reference, lines: made };
    });

  type Item = ReturnType<typeof itemsOf>[number];
  // Every usable section has at least four items (checked above).
  const four = (s: (typeof usable)[number]): [Item, Item, Item, Item, Item | undefined] => {
    const [x, y, z, w, v] = itemsOf(s);
    return [x!, y!, z!, w!, v];
  };
  const [a1, a2, a3, a4, a5] = four(secA);
  const [b1, b2, b3, b4] = four(secB);
  const [c1, c2, c3, c4] = four(secC);
  const hist = (item: { id: string }, ...diffs: number[]) => new Map([[item.id, diffs.map(D)]]);

  // 1. The Attendant's OPEN count: a few numbers in, one skipped, one zero.
  const open = await makeCount({
    counter: attendant,
    section: secA,
    status: 'OPEN',
    startedAt: ago(40 * 60_000),
    key: 'open',
    plans: [
      { item: a1, counted: Number(onHand.get(a1.id)) },
      { item: a2, counted: 0 },
      { item: a3, counted: null }, // skipped (odd position)
      { item: a4, counted: Number(onHand.get(a4.id)) - 2 },
      ...(a5 ? [{ item: a5, counted: null } as Plan] : []),
    ],
  });

  // 2. Two older signed counts of an item that the Manager's count below makes a THIRD short run (a repeat shortfall).
  const shortItem = c1;
  for (const [n, days] of [[1, 6], [2, 3]] as const) {
    await makeCount({
      counter: attendant,
      section: secC,
      status: 'APPROVED',
      startedAt: ago(days * DAY + HOUR),
      signedAt: ago(days * DAY),
      key: `old-${n}`,
      plans: [{ item: shortItem, counted: Number(onHand.get(shortItem.id)) - 1, expected: onHand.get(shortItem.id)! }],
    });
  }

  // 3. The second Attendant's SUBMITTED count: waiting for the Manager, with lines inside and outside the range.
  const submitted = await makeCount({
    counter: peter,
    section: secB,
    status: 'SUBMITTED',
    startedAt: ago(3 * HOUR),
    signedAt: ago(2 * HOUR),
    key: 'submitted',
    plans: [
      { item: b1, counted: Number(onHand.get(b1.id)) },
      { item: b2, counted: Number(onHand.get(b2.id)) - 1 }, // KES a unit: within or outside by the item's cost
      { item: b3, counted: Number(onHand.get(b3.id)) - 12, recheck: 'RECOUNTED', first: Number(onHand.get(b3.id)) - 14 }, // outside the range
      { item: b4, counted: null },
    ],
  });

  // 4. The Store Manager's own APPROVED count: every non-zero line applied, outside-range lines flagged to the Director.
  const own = await makeCount({
    counter: manager,
    section: secC,
    status: 'APPROVED',
    selfSigned: true,
    startedAt: ago(HOUR),
    signedAt: ago(30 * 60_000),
    key: 'own',
    history: hist(shortItem, -1, -1),
    plans: [
      { item: c1, counted: Number(onHand.get(c1.id)) - 1 },
      { item: c2, counted: Number(onHand.get(c2.id)) - 15 },
      { item: c3, counted: Number(onHand.get(c3.id)) },
      { item: c4, counted: null },
    ],
  });
  await prisma.$transaction(async (tx) => {
    for (const line of own.lines) {
      if (!line.difference || line.difference.isZero()) continue;
      const item = touched.find((i) => i.id === line.itemId)!;
      const outside = line.result === 'EXCEEDS';
      const alerting = line.difference.times(item.currentCost).abs().greaterThanOrEqualTo(settings.directorAlertKes);
      await tx.countLine.update({
        where: { id: line.id },
        data: {
          decision: outside ? 'WRITE_OFF' : 'ACCEPTED',
          cause: outside ? 'PREP_NOT_LOGGED' : null,
          decidedById: manager.id,
          decidedAt: ago(30 * 60_000),
          directorFlagged: outside || alerting,
          directorAlert: alerting,
        },
      });
      await postStockMovement(tx, {
        type: 'ADJUSTMENT',
        locationId: location.id,
        inventoryItemId: line.itemId,
        quantity: line.difference,
        unitCost: item.currentCost,
        reason: outside ? 'Prep use not logged' : 'Within range · accepted',
        userId: manager.id,
        links: { countLineId: line.id },
      });
    }
  });

  // 5. An Attendant move the Manager can undo: an item taken out of section B into "Others".
  const others = await prisma.countSection.findFirst({ where: { siteId, name: 'Others' } });
  if (others) {
    await prisma.$transaction(async (tx) => {
      const placed = await tx.countSectionItem.findFirst({ where: { siteId, sectionId: secB.id, inventoryItemId: b4.id } });
      if (!placed) return;
      const last = await tx.countSectionItem.aggregate({ where: { sectionId: others.id }, _max: { position: true } });
      await tx.countSectionItem.update({ where: { id: placed.id }, data: { sectionId: others.id, position: (last._max.position ?? -1) + 1 } });
      await tx.countItemMove.create({ data: { siteId, inventoryItemId: b4.id, fromSectionId: secB.id, toSectionId: others.id, movedById: attendant.id, movedAt: ago(20 * 60_000) } });
    });
  }

  console.log('Counting dev fixtures ready:');
  console.log(`  OPEN       ${open.reference}  ${attendant.name}  (${secA.name})`);
  console.log(`  SUBMITTED  ${submitted.reference}  ${peter.name}  (${secB.name})  waiting for ${manager.name}`);
  console.log(`  APPROVED   ${own.reference}  ${manager.name}  (${secC.name})  self-signed, ${own.lines.filter((l) => l.result === 'EXCEEDS').length} line(s) flagged to the Director`);
  console.log(`  Repeat shortfall: ${shortItem.name} (3 short counts running)`);
  console.log(`  Moved by the Attendant: ${b4.name} -> Others (undo it in Count setup)`);
  console.log(`  Logins (password123, signing PIN ${PIN}): store.manager, store.attendant, dev.peter.attendant, admin, director, accountant, bm.town @wendo.test`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
