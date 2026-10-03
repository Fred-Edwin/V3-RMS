/**
 * seed-counting-dev-fixtures.ts
 *
 * Local dev-only fixtures for Milestone Six Session 2 (Central Store
 * counting), so the live screens can be compared against the Paper artboards
 * in the same state (session-2-plan.md "Seed for the gate"):
 *
 *   - Catalog shaped to the daily-count tabs: Dairy 24 · Dry goods 45 ·
 *     Produce 18 (surplus Dry-goods fillers move to "Dry items"; fillers are
 *     renamed into the dairy / produce names, so the live item total stays
 *     put). "Whole chicken 1.2kg" and "Fresh cream 250ml" exist.
 *   - Yesterday's VERIFIED daily count (matches `18GE-0`: 36 lines, 30
 *     matched, 6 variance, net −KES 1,240, ADJ-3402…3407, signed J. Mwangi).
 *   - Two VERIFIED spot counts (3 and 8 days ago; the recent one is
 *     Director-flagged, for the print "flagged" variant).
 *   - Today's DAILY count in the state given by `--state=`:
 *       submitted (default) — matches `181V-0`: 142 lines, 6 variance, 2 above
 *                             threshold, net −KES 3,120, submitted 07:10 by
 *                             Sarah Achieng.
 *       draft               — the blind-entry state (`18KU-0`): 8 Dairy items counted.
 *       returned            — `1F4N-0`: the chicken line queried and sent back.
 *       none                — no count today (attendant starts from empty).
 *   - Thresholds are left at their defaults (the row is removed).
 *
 * Every date is computed from "now" on every run (Session 1's fixture wrote
 * dates once and aged out of the 7-day window). Idempotent: it removes all
 * previous count-derived rows (counts, lines, count ADJUSTMENTs, compensating
 * fixture receipts) and rewrites them. ONLY runs when NODE_ENV is not
 * "production". Run after seed-stock-waste-dev-fixtures.ts.
 *
 * Usage:
 *   npx tsx src/scripts/seed-counting-dev-fixtures.ts [--state=submitted|draft|returned|none]
 */

import 'dotenv/config';
import { Prisma, type CountReason, type InventoryItem, type InventoryItemType } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { formatDateOnly, getTodayDateOnly } from '../utils/date-only';

if (env.NODE_ENV === 'production') {
  console.error('ERROR: seed-counting-dev-fixtures must not run in production. Exiting.');
  process.exit(1);
}

const FIXTURE_NOTE = 'M6 S2 dev fixture';
const D = (v: string | number) => new Prisma.Decimal(v);

const stateArg = process.argv.find((a) => a.startsWith('--state='))?.split('=')[1] ?? 'submitted';
if (!['submitted', 'draft', 'returned', 'none'].includes(stateArg)) {
  console.error(`Unknown --state=${stateArg}`);
  process.exit(1);
}

// name, unit, cost
const DAIRY: [string, string, string][] = [
  ['Fresh cream 250ml', 'units', '120'],
  ['Butter', 'kg', '780'],
  ['Yoghurt 500ml', 'units', '95'],
  ['Cheddar', 'kg', '1100'],
  ['Mozzarella 1kg', 'kg', '950'],
  ['Feta 200g', 'units', '310'],
  ['Parmesan 500g', 'units', '1450'],
  ['Cream cheese 200g', 'units', '260'],
  ['Ricotta 250g', 'units', '280'],
  ['Sour cream 250ml', 'units', '150'],
  ['Condensed milk 400g', 'units', '170'],
  ['Evaporated milk 410g', 'units', '160'],
  ['UHT milk 1L', 'L', '110'],
  ['Skimmed milk 1L', 'L', '120'],
  ['Oat milk 1L', 'L', '230'],
  ['Almond milk 1L', 'L', '340'],
  ['Whipping cream 1L', 'L', '690'],
  ['Ghee 500g', 'units', '640'],
  ['Paneer 250g', 'units', '300'],
  ['Halloumi 250g', 'units', '520'],
  ['Greek yoghurt 1kg', 'kg', '410'],
  ['Cottage cheese 300g', 'units', '240'],
];
const PRODUCE: [string, string, string][] = [
  ['Whole chicken 1.2kg', 'kg', '90'],
  ['Onions', 'kg', '70'],
  ['Carrots', 'kg', '60'],
  ['Potatoes', 'kg', '55'],
  ['Spinach', 'kg', '80'],
  ['Kale', 'kg', '50'],
  ['Avocados', 'pcs', '25'],
  ['Lemons', 'pcs', '15'],
  ['Bananas', 'kg', '65'],
  ['Garlic', 'kg', '320'],
  ['Ginger', 'kg', '260'],
  ['Capsicum', 'kg', '150'],
  ['Cabbage', 'pcs', '45'],
  ['Cucumber', 'pcs', '20'],
  ['Coriander', 'kg', '200'],
  ['Mangoes', 'pcs', '30'],
  ['Pineapples', 'pcs', '90'],
];
const SAFFRON = { name: 'Saffron 50g', unit: 'units', cost: '6500', category: 'Dry goods' };

const FILLER_BASES = [
  'Sugar', 'Salt', 'Black pepper', 'Paprika', 'Cinnamon', 'Oats', 'Honey', 'Strawberry jam', 'Peanut butter', 'Ketchup',
  'Mayonnaise', 'Mustard', 'Vinegar', 'Baking powder', 'Dry yeast', 'Cocoa powder', 'Vanilla essence', 'Penne pasta',
  'Spaghetti', 'Lentils', 'Kidney beans', 'Maize flour', 'Tea leaves', 'Drinking chocolate', 'Icing sugar',
];
const FILLER_PACKS = ['250 g', '500 g', '1 kg', '2 kg'];
const FILLER_NAMES = new Set(FILLER_PACKS.flatMap((p) => FILLER_BASES.map((b) => `${b} ${p}`)));

/** The Paper items other sessions' gates depend on — never given fixture variance. */
const PAPER_ITEMS = ['Milk', 'Cooking oil', 'Coffee beans', 'Chicken stock', 'Rice', 'Tomatoes', 'Flour', 'Cream'];

/** An instant at a Nairobi wall-clock time, `daysBack` days before the Nairobi date of "now". */
const nairobiAt = (daysBack: number, hh: number, mm = 0): Date => {
  const base = getTodayDateOnly(); // UTC midnight of the Nairobi date
  return new Date(base.getTime() - daysBack * 86_400_000 + (hh - 3) * 3_600_000 + mm * 60_000);
};
const dateOnlyDaysBack = (n: number): Date => new Date(getTodayDateOnly().getTime() - n * 86_400_000);
const clampToNow = (d: Date): Date => (d.getTime() > Date.now() ? new Date(Date.now() - 60_000) : d);

const dailyRef = (d: Date): string => {
  const [y, m, day] = formatDateOnly(d).split('-');
  return `CNT-${y}-${m}${day}`;
};

const run = async (): Promise<void> => {
  const hub = await prisma.site.findFirst({ where: { isHub: true } });
  const store = await prisma.location.findFirst({ where: { type: 'CENTRAL_STORE' } });
  const sm = await prisma.user.findUnique({ where: { email: 'store.manager@wendo.test' } });
  const att = await prisma.user.findUnique({ where: { email: 'store.attendant@wendo.test' } });
  if (!hub || !store || !sm || !att) {
    console.log('SKIP  hub / Central Store / store users missing — run seed-dev.ts + seed-stock-waste-dev-fixtures.ts first');
    return;
  }

  // --- 0. Clear previous count data ---------------------------------------------------------
  const oldLines = await prisma.stockCountLine.findMany({ where: { stockCount: { siteId: hub.id } }, select: { id: true } });
  const removed = await prisma.$transaction(async (tx) => {
    const tr = await tx.inventoryTransaction.deleteMany({
      where: {
        siteId: hub.id,
        OR: [{ stockCountLineId: { in: oldLines.map((l) => l.id) } }, { reason: { startsWith: FIXTURE_NOTE } }],
      },
    });
    await tx.stockCountLine.deleteMany({ where: { stockCount: { siteId: hub.id } } });
    await tx.stockCount.deleteMany({ where: { siteId: hub.id } });
    await tx.countingThresholds.deleteMany({ where: { siteId: hub.id } });
    await tx.referenceCounter.upsert({
      where: { siteId_prefix: { siteId: hub.id, prefix: 'SPT' } },
      update: { lastNumber: 0 },
      create: { siteId: hub.id, prefix: 'SPT', lastNumber: 0 },
    });
    // ADJ-3402 is the first number on `18GE-0`.
    await tx.referenceCounter.upsert({
      where: { siteId_prefix: { siteId: hub.id, prefix: 'ADJ' } },
      update: { lastNumber: 3401 },
      create: { siteId: hub.id, prefix: 'ADJ', lastNumber: 3401 },
    });
    return tr.count;
  });
  console.log(`OK    cleared previous count data (${removed} ledger rows)`);

  // --- 1. Shape the catalog ------------------------------------------------------------------
  const cat = async (name: string) =>
    (await prisma.category.findFirst({ where: { siteId: hub.id, name, deletedAt: null } })) ??
    (await prisma.category.create({ data: { siteId: hub.id, name } }));
  const [dairy, produce, dryGoods, dryItems] = await Promise.all([cat('Dairy'), cat('Produce'), cat('Dry goods'), cat('Dry items')]);

  const live = () => prisma.inventoryItem.findMany({ where: { siteId: hub.id, deletedAt: null } });
  let items = await live();
  const byName = new Map(items.map((i) => [i.name, i]));
  const fillerPool = items.filter((i) => FILLER_NAMES.has(i.name));

  const shape = async (name: string, unit: string, cost: string, categoryId: string, type: InventoryItemType = 'STOCKED') => {
    const existing = byName.get(name);
    if (existing) {
      await prisma.inventoryItem.update({ where: { id: existing.id }, data: { categoryId, currentCost: D(cost), usageUnit: unit, buyUnit: unit } });
      return;
    }
    const donor = fillerPool.pop();
    if (donor) {
      await prisma.inventoryItem.update({
        where: { id: donor.id },
        data: { name, categoryId, currentCost: D(cost), usageUnit: unit, buyUnit: unit, type },
      });
    } else {
      await prisma.inventoryItem.create({
        data: { siteId: hub.id, name, type, usageUnit: unit, buyUnit: unit, categoryId, currentCost: D(cost), departmentTags: [] },
      });
    }
  };
  for (const [n, u, c] of DAIRY) await shape(n, u, c, dairy.id);
  for (const [n, u, c] of PRODUCE) await shape(n, u, c, produce.id);
  await shape(SAFFRON.name, SAFFRON.unit, SAFFRON.cost, dryGoods.id);

  // Tomatoes stays in Produce; Dry goods trimmed to 45 (Paper set stays put).
  await prisma.inventoryItem.updateMany({ where: { siteId: hub.id, name: 'Tomatoes', deletedAt: null }, data: { categoryId: produce.id } });
  items = await live();
  const dryNow = items.filter((i) => i.categoryId === dryGoods.id && !PAPER_ITEMS.includes(i.name) && i.name !== SAFFRON.name);
  const surplus = items.filter((i) => i.categoryId === dryGoods.id).length - 45;
  if (surplus > 0) {
    const movable = dryNow.slice(0, surplus);
    await prisma.inventoryItem.updateMany({ where: { id: { in: movable.map((m) => m.id) } }, data: { categoryId: dryItems.id } });
  }
  items = await live();
  const named = (n: string): InventoryItem => {
    const i = items.find((x) => x.name === n);
    if (!i) throw new Error(`fixture item missing: ${n}`);
    return i;
  };
  console.log(`OK    catalog shaped: ${items.length} live items (Dairy ${items.filter((i) => i.categoryId === dairy.id).length}, Produce ${items.filter((i) => i.categoryId === produce.id).length}, Dry goods ${items.filter((i) => i.categoryId === dryGoods.id).length})`);

  // --- 2. Opening balances so every item has believable on-hand -------------------------------
  const sumByItem = async (): Promise<Map<string, Prisma.Decimal>> => {
    const rows = await prisma.inventoryTransaction.groupBy({
      by: ['inventoryItemId'],
      where: { siteId: hub.id, locationId: store.id },
      _sum: { quantity: true },
    });
    return new Map(rows.map((r) => [r.inventoryItemId, r._sum.quantity ?? D(0)]));
  };
  let onHand = await sumByItem();
  const openings: Prisma.InventoryTransactionUncheckedCreateInput[] = [];
  items.forEach((item, idx) => {
    if (PAPER_ITEMS.includes(item.name)) return;
    const have = onHand.get(item.id) ?? D(0);
    if (!have.isZero()) return;
    // Chicken 36 → 27 after yesterday's −9; cream 39 (design); everything else deterministic 20–110.
    const qty = item.name === 'Whole chicken 1.2kg' ? 36 : item.name === 'Fresh cream 250ml' ? 39 : 20 + ((idx * 17) % 91);
    openings.push({
      siteId: hub.id, locationId: store.id, inventoryItemId: item.id, type: 'RECEIVE', quantity: D(qty),
      unitCost: item.currentCost, reason: `${FIXTURE_NOTE} — opening balance`, userId: sm.id, createdAt: nairobiAt(20, 9),
    });
  });
  if (openings.length > 0) await prisma.inventoryTransaction.createMany({ data: openings });
  onHand = await sumByItem();
  console.log(`OK    ${openings.length} opening balances (items that had no stock)`);

  // --- 3. Count writers ----------------------------------------------------------------------------
  const reasonThreshold = 500;
  const directorThreshold = 5000;
  let adjNumber = 3401;
  let sptNumber = 0;
  const nextAdj = () => `ADJ-${String(++adjNumber).padStart(4, '0')}`;
  const nextSpt = () => `SPT-${String(++sptNumber).padStart(4, '0')}`;

  type Spec = { item: InventoryItem; variance: number; reason?: CountReason; cost?: string };
  /** Writes a VERIFIED count (daily or spot) with its adjustments, dated in the past. */
  const writeVerified = async (input: {
    kind: 'DAILY' | 'SPOT';
    daysBack: number;
    signedAt: Date;
    verifiedAt: Date;
    counterId: string;
    variances: Spec[];
    matched: InventoryItem[];
  }): Promise<void> => {
    const date = dateOnlyDaysBack(input.daysBack);
    await prisma.$transaction(async (tx) => {
      const lines: { item: InventoryItem; counted: Prisma.Decimal; expected: Prisma.Decimal; cost: Prisma.Decimal; variance: Prisma.Decimal; reason?: CountReason; reasonRequired: boolean }[] = [];
      for (const v of input.variances) {
        if (v.cost) await tx.inventoryItem.update({ where: { id: v.item.id }, data: { currentCost: D(v.cost) } });
        const cost = D(v.cost ?? v.item.currentCost.toString());
        const now = onHand.get(v.item.id) ?? D(0);
        // A Paper item keeps today's on-hand (a compensating receipt earlier), so other
        // sessions' figures (Milk 128 …) still hold; every other item just moves.
        const variance = D(v.variance);
        const compensate = variance.isNegative() && PAPER_ITEMS.includes(v.item.name);
        if (compensate) {
          await tx.inventoryTransaction.create({
            data: {
              siteId: hub.id, locationId: store.id, inventoryItemId: v.item.id, type: 'RECEIVE', quantity: variance.negated(),
              unitCost: cost, reason: `${FIXTURE_NOTE} — stock before the count`, userId: sm.id, createdAt: nairobiAt(input.daysBack + 1, 15),
            },
          });
        }
        const expected = compensate ? now.minus(variance) : now;
        lines.push({
          item: v.item, expected, counted: expected.plus(variance), cost, variance, reason: v.reason,
          reasonRequired: variance.times(cost).abs().greaterThanOrEqualTo(reasonThreshold),
        });
        onHand.set(v.item.id, expected.plus(variance));
      }
      for (const m of input.matched) {
        const now = onHand.get(m.id) ?? D(0);
        lines.push({ item: m, expected: now, counted: now, cost: m.currentCost, variance: D(0), reasonRequired: false });
      }
      const reference = input.kind === 'DAILY' ? dailyRef(date) : nextSpt();
      const alert = lines.some((l) => !l.variance.isZero() && l.variance.times(l.cost).abs().greaterThanOrEqualTo(directorThreshold));
      const count = await tx.stockCount.create({
        data: {
          siteId: hub.id, locationId: store.id, kind: input.kind, countDate: date, status: 'VERIFIED', reference,
          counterId: input.counterId, counterSignedAt: input.signedAt, verifierId: sm.id, verifiedAt: input.verifiedAt,
          directorNotified: alert,
          lines: {
            create: lines.map((l) => ({
              inventoryItemId: l.item.id, countedQty: l.counted, expectedQty: l.expected, unitCost: l.cost, decision: 'ACCEPTED' as const,
              reason: l.reason ?? null, reasonRequired: l.reasonRequired,
            })),
          },
        },
        include: { lines: true },
      });
      for (const line of count.lines) {
        const l = lines.find((x) => x.item.id === line.inventoryItemId)!;
        if (l.variance.isZero()) continue;
        await tx.inventoryTransaction.create({
          data: {
            siteId: hub.id, locationId: store.id, inventoryItemId: line.inventoryItemId, type: 'ADJUSTMENT', quantity: l.variance,
            unitCost: l.cost, reason: l.reason ?? null, stockCountLineId: line.id, reference: nextAdj(), userId: sm.id, createdAt: input.verifiedAt,
          },
        });
      }
    }, { timeout: 60_000 });
    await prisma.referenceCounter.update({
      where: { siteId_prefix: { siteId: hub.id, prefix: 'ADJ' } },
      data: { lastNumber: adjNumber },
    });
  };

  const fillers = () => items.filter((i) => FILLER_NAMES.has(i.name) && i.categoryId !== dairy.id && i.categoryId !== produce.id);
  const pool = fillers();
  const pick = (skip: number): InventoryItem => {
    const f = pool[skip];
    if (!f) throw new Error('not enough filler items for the fixture');
    return f;
  };
  const excluded = new Set<string>();
  const mark = (i: InventoryItem) => (excluded.add(i.id), i);

  // --- 4. Yesterday: VERIFIED daily count (18GE-0) -------------------------------------------------
  const chicken = named('Whole chicken 1.2kg');
  const milk = named('Milk');
  const sugar = mark(pick(0));
  const y1 = mark(pick(1));
  const y2 = mark(pick(2));
  const y3 = mark(pick(3));
  const yesterdayMatched = items
    .filter((i) => !excluded.has(i.id) && ![chicken.id, milk.id].includes(i.id))
    .slice(0, 30);
  await writeVerified({
    kind: 'DAILY', daysBack: 1, signedAt: nairobiAt(1, 7, 10), verifiedAt: nairobiAt(1, 9, 40), counterId: att.id,
    variances: [
      { item: milk, variance: -4 }, // −KES 260
      { item: chicken, variance: -9, reason: 'UNLOGGED_SPOILAGE' }, // −KES 810
      { item: sugar, variance: 2, cost: '110' }, // +KES 220
      { item: y1, variance: -2, cost: '125' }, // −KES 250
      { item: y2, variance: -2, cost: '60' }, // −KES 120
      { item: y3, variance: -1, cost: '20' }, // −KES 20
    ],
    matched: yesterdayMatched,
  });
  console.log('OK    yesterday: VERIFIED daily count (36 lines, 6 variance, net −KES 1,240)');

  // --- 5. Spot counts ----------------------------------------------------------------------------------
  const saffron = named(SAFFRON.name);
  await writeVerified({
    kind: 'SPOT', daysBack: 3, signedAt: nairobiAt(3, 11, 20), verifiedAt: nairobiAt(3, 11, 20), counterId: sm.id,
    variances: [{ item: saffron, variance: -1, reason: 'SUSPECTED_LOSS' }], // −KES 6,500 → Director-flagged
    matched: [named('Coffee beans'), named('Cooking oil')],
  });
  const s1 = mark(pick(4));
  await writeVerified({
    kind: 'SPOT', daysBack: 8, signedAt: nairobiAt(8, 10, 5), verifiedAt: nairobiAt(8, 10, 5), counterId: sm.id,
    variances: [{ item: s1, variance: -2, cost: '90' }], // −KES 180
    matched: [named('Rice')],
  });
  console.log('OK    spot counts: 3 days ago (Director-flagged), 8 days ago (1 adjustment, −KES 180)');
  await prisma.referenceCounter.update({
    where: { siteId_prefix: { siteId: hub.id, prefix: 'SPT' } },
    data: { lastNumber: sptNumber },
  });

  // --- 6. Today's daily count --------------------------------------------------------------------------
  if (stateArg === 'none') {
    console.log('OK    today: no count');
    return;
  }
  onHand = await sumByItem();
  const today = getTodayDateOnly();
  const all = await live();
  const cream = named('Fresh cream 250ml');
  const coffee = named('Coffee beans');
  const a = mark(pick(5));
  const b = mark(pick(6));
  const c = mark(pick(7));
  await prisma.inventoryItem.update({ where: { id: a.id }, data: { currentCost: D(100) } });
  await prisma.inventoryItem.update({ where: { id: b.id }, data: { currentCost: D(50) } });
  await prisma.inventoryItem.update({ where: { id: c.id }, data: { currentCost: D(120) } });
  const variance = new Map<string, number>([
    [chicken.id, -9], // −KES 810 (above threshold)
    [cream.id, -3], // −KES 360
    [coffee.id, -1], // −KES 1,180 (above threshold)
    [a.id, -4], // −KES 400
    [b.id, -5], // −KES 250
    [c.id, -1], // −KES 120
  ]);
  const costOf = (i: InventoryItem): Prisma.Decimal => (i.id === a.id ? D(100) : i.id === b.id ? D(50) : i.id === c.id ? D(120) : i.currentCost);

  const signedAt = clampToNow(nairobiAt(0, 7, 10));
  const dairyItems = all.filter((i) => i.categoryId === dairy.id).sort((x, y) => x.name.localeCompare(y.name));
  // Milk and Fresh cream first (the two counted rows `18KU-0` draws), then the next six by name.
  const firstTwo = dairyItems.filter((i) => i.id === milk.id || i.id === cream.id);
  const draftCounted = new Set([...firstTwo, ...dairyItems.filter((i) => !firstTwo.includes(i))].slice(0, 8).map((i) => i.id));

  const submitted = stateArg !== 'draft';
  const returned = stateArg === 'returned';
  const count = await prisma.stockCount.create({
    data: {
      siteId: hub.id, locationId: store.id, kind: 'DAILY', countDate: today, reference: dailyRef(today), counterId: att.id,
      status: returned ? 'RETURNED' : submitted ? 'SUBMITTED' : 'DRAFT',
      counterSignedAt: submitted ? signedAt : null,
      returnNote: returned ? 'Just the chicken, please — everything else is accepted.' : null,
      returnedAt: returned ? clampToNow(nairobiAt(0, 8, 42)) : null,
      returnedById: returned ? sm.id : null,
      lines: {
        create: all.map((i) => {
          const have = onHand.get(i.id) ?? D(0);
          const v = variance.get(i.id) ?? 0;
          const cost = costOf(i);
          const isQueried = returned && i.id === chicken.id;
          if (!submitted) {
            return {
              inventoryItemId: i.id,
              countedQty: draftCounted.has(i.id) ? have : null,
            };
          }
          const counted = have.plus(v);
          const reasonRequired = v !== 0 && D(v).times(cost).abs().greaterThanOrEqualTo(reasonThreshold);
          return {
            inventoryItemId: i.id,
            countedQty: isQueried ? null : counted,
            firstCountedQty: isQueried ? counted : null,
            expectedQty: have,
            unitCost: cost,
            reasonRequired,
            decision: isQueried ? ('QUERIED' as const) : v === 0 || !reasonRequired ? ('ACCEPTED' as const) : ('PENDING' as const),
            queryNote: isQueried ? 'Recount the back shelf of the cold room, including the open crate.' : null,
          };
        }),
      },
    },
  });
  console.log(`OK    today: ${stateArg.toUpperCase()} daily count ${count.reference} (${all.length} lines)`);
};

run()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
