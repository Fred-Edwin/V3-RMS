import 'dotenv/config';
import {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PrepStation,
  PrepTicketStatus,
  Prisma,
  PrismaClient,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

const SEED_NOTE_PREFIX = '[seed-report:';
const DEFAULT_CHUNK_SIZE = 500;

type BranchUserPools = {
  waiters: string[];
  chefs: string[];
  baristas: string[];
  fallback: string[];
};

type BranchMenuItem = {
  id: string;
  name: string;
  price: Prisma.Decimal;
  categoryName: string;
  station: PrepStation;
};

type SeedArgs = {
  days: number;
  minOrders: number;
  maxOrders: number;
  reset: boolean;
  seed: number;
  organizationIds: string[] | null;
};

type SeedStats = {
  organizationName: string;
  ordersCreated: number;
  totalRevenue: Prisma.Decimal;
};

type PreparedRows = {
  orders: Prisma.OrderCreateManyInput[];
  orderItems: Prisma.OrderItemCreateManyInput[];
  prepTickets: Prisma.PrepTicketCreateManyInput[];
  totalRevenue: Prisma.Decimal;
};

class LcgRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  int(min: number, max: number): number {
    const lower = Math.ceil(min);
    const upper = Math.floor(max);
    return Math.floor(this.next() * (upper - lower + 1)) + lower;
  }

  pick<T>(values: T[]): T {
    if (values.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    return values[this.int(0, values.length - 1)] as T;
  }
}

const printUsage = (): void => {
  console.log('Usage: pnpm seed:reports -- --days=20 --min-orders=5 --max-orders=20 --seed=42 [--reset] [--org=<id>]');
  console.log('Required env var: SEED_REPORTS_CONFIRM=YES');
  console.log('Optional env override in production: ALLOW_PRODUCTION_SEED=true');
};

const parsePositiveInt = (value: string, label: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer. Received: ${value}`);
  }
  return parsed;
};

const parseArgs = (argv: string[]): SeedArgs => {
  let days = 20;
  let minOrders = 6;
  let maxOrders = 18;
  let reset = false;
  let seed = 42;
  const organizationIds: string[] = [];

  for (const arg of argv) {
    if (arg === '--help') {
      printUsage();
      process.exit(0);
    }

    if (arg === '--reset') {
      reset = true;
      continue;
    }

    if (arg.startsWith('--days=')) {
      days = parsePositiveInt(arg.slice('--days='.length), 'days');
      continue;
    }

    if (arg.startsWith('--min-orders=')) {
      minOrders = parsePositiveInt(arg.slice('--min-orders='.length), 'min-orders');
      continue;
    }

    if (arg.startsWith('--max-orders=')) {
      maxOrders = parsePositiveInt(arg.slice('--max-orders='.length), 'max-orders');
      continue;
    }

    if (arg.startsWith('--seed=')) {
      seed = parsePositiveInt(arg.slice('--seed='.length), 'seed');
      continue;
    }

    if (arg.startsWith('--org=')) {
      const orgId = arg.slice('--org='.length).trim();
      if (!orgId) {
        throw new Error('--org requires a branch id value');
      }
      organizationIds.push(orgId);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (minOrders > maxOrders) {
    throw new Error('min-orders must be less than or equal to max-orders');
  }

  return {
    days,
    minOrders,
    maxOrders,
    reset,
    seed,
    organizationIds: organizationIds.length > 0 ? organizationIds : null,
  };
};

const ensureSafetyGuards = (): void => {
  if (process.env.SEED_REPORTS_CONFIRM !== 'YES') {
    throw new Error('Refusing to seed report data. Set SEED_REPORTS_CONFIRM=YES to proceed.');
  }

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error('Refusing to seed in production. Set ALLOW_PRODUCTION_SEED=true to override intentionally.');
  }
};

const startOfUtcDay = (date: Date): Date => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const addUtcDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const addMinutesUtc = (date: Date, minutes: number): Date => {
  return new Date(date.getTime() + minutes * 60_000);
};

const dateKey = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

const categoryWeight = (name: string): number => {
  const normalized = name.toLowerCase();
  if (
    normalized.includes('coffee') ||
    normalized.includes('beverage') ||
    normalized.includes('drink') ||
    normalized.includes('tea')
  ) {
    return 1.8;
  }

  if (
    normalized.includes('dessert') ||
    normalized.includes('pastry') ||
    normalized.includes('snack')
  ) {
    return 1.35;
  }

  return 1;
};

const weightedPick = <T>(values: T[], getWeight: (value: T) => number, rng: LcgRng): T => {
  if (values.length === 0) {
    throw new Error('Cannot pick from empty values');
  }

  let totalWeight = 0;
  const weights = values.map((value) => {
    const weight = Math.max(0.001, getWeight(value));
    totalWeight += weight;
    return weight;
  });

  let threshold = rng.next() * totalWeight;
  for (let index = 0; index < values.length; index += 1) {
    threshold -= weights[index] ?? 0;
    if (threshold <= 0) {
      return values[index] as T;
    }
  }

  return values[values.length - 1] as T;
};

const buildUserPools = async (organizationId: string): Promise<BranchUserPools> => {
  const users = await prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
      role: {
        in: ['WAITER', 'CHEF', 'BARISTA', 'MANAGER'],
      },
    },
    select: {
      id: true,
      role: true,
    },
  });

  const waiters = users.filter((user) => user.role === UserRole.WAITER).map((user) => user.id);
  const chefs = users.filter((user) => user.role === UserRole.CHEF).map((user) => user.id);
  const baristas = users.filter((user) => user.role === UserRole.BARISTA).map((user) => user.id);
  const fallback = users.map((user) => user.id);

  return {
    waiters,
    chefs,
    baristas,
    fallback,
  };
};

const buildMenuPool = async (organizationId: string): Promise<BranchMenuItem[]> => {
  const menuItems = await prisma.menuItem.findMany({
    where: {
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      price: true,
      category: {
        select: {
          name: true,
          prepStation: true,
        },
      },
      branchOverrides: {
        where: {
          organizationId,
        },
        select: {
          isAvailable: true,
        },
        take: 1,
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return menuItems
    .filter((item) => {
      const override = item.branchOverrides[0];
      return override?.isAvailable !== false;
    })
    .map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      categoryName: item.category.name,
      station: item.category.prepStation,
    }));
};

const chooseOrderType = (rng: LcgRng): OrderType => {
  const roll = rng.next();
  if (roll < 0.52) {
    return OrderType.DINE_IN;
  }
  if (roll < 0.87) {
    return OrderType.TAKE_AWAY;
  }
  return OrderType.DELIVERY;
};

const choosePaymentMethod = (rng: LcgRng): PaymentMethod => {
  const roll = rng.next();
  if (roll < 0.58) {
    return PaymentMethod.MPESA;
  }
  if (roll < 0.83) {
    return PaymentMethod.CASH;
  }
  return PaymentMethod.CARD;
};

const chooseCreatedById = (pools: BranchUserPools, rng: LcgRng): string => {
  if (pools.waiters.length > 0) {
    return rng.pick(pools.waiters);
  }
  return rng.pick(pools.fallback);
};

const chooseClaimedById = (station: PrepStation, pools: BranchUserPools, rng: LcgRng): string | null => {
  if (station === PrepStation.KITCHEN && pools.chefs.length > 0) {
    return rng.pick(pools.chefs);
  }
  if (station === PrepStation.BARISTA && pools.baristas.length > 0) {
    return rng.pick(pools.baristas);
  }
  return pools.fallback.length > 0 ? rng.pick(pools.fallback) : null;
};

const buildOrderItems = (
  availableMenuItems: BranchMenuItem[],
  rng: LcgRng,
): Array<{
  menuItemId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  name: string;
  station: PrepStation;
}> => {
  const itemCount = rng.int(1, 4);
  const items: Array<{
    menuItemId: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    subtotal: Prisma.Decimal;
    name: string;
    station: PrepStation;
  }> = [];

  for (let index = 0; index < itemCount; index += 1) {
    const selected = weightedPick(availableMenuItems, (item) => categoryWeight(item.categoryName), rng);
    const quantity = rng.int(1, 3);
    const subtotal = selected.price.mul(quantity);
    items.push({
      menuItemId: selected.id,
      quantity,
      unitPrice: selected.price,
      subtotal,
      name: selected.name,
      station: selected.station,
    });
  }

  return items;
};

const getDailyOrderCount = (
  dayDate: Date,
  index: number,
  multiplier: number,
  args: SeedArgs,
  rng: LcgRng,
): number => {
  const dayOfWeek = dayDate.getUTCDay();
  const weekendBoost = dayOfWeek === 5 || dayOfWeek === 6 ? 1.2 : 1;
  const trend = 1 + (index / Math.max(1, args.days - 1)) * 0.35;
  const min = Math.max(1, Math.round(args.minOrders * multiplier * weekendBoost * trend));
  const max = Math.max(min, Math.round(args.maxOrders * multiplier * weekendBoost * trend));
  return rng.int(min, max);
};

const buildInitialDailyNumbers = async (
  organizationId: string,
  startDate: Date,
  endDate: Date,
): Promise<Map<string, number>> => {
  const grouped = await prisma.order.groupBy({
    by: ['orderDate'],
    where: {
      organizationId,
      orderDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    _max: {
      dailyNumber: true,
    },
  });

  const nextByDay = new Map<string, number>();
  for (const row of grouped) {
    nextByDay.set(dateKey(row.orderDate), (row._max.dailyNumber ?? 0) + 1);
  }
  return nextByDay;
};

const insertInChunks = async <T>(
  label: string,
  rows: T[],
  insert: (chunk: T[]) => Promise<{ count: number }>,
  chunkSize: number,
): Promise<void> => {
  if (rows.length === 0) {
    return;
  }

  let inserted = 0;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize);
    const result = await insert(chunk);
    inserted += result.count;
    console.log(`  ${label}: ${inserted}/${rows.length}`);
  }
};

const prepareRowsForOrganization = async (
  organizationId: string,
  organizationIndex: number,
  args: SeedArgs,
  seedTag: string,
  userPools: BranchUserPools,
  menuPool: BranchMenuItem[],
  rng: LcgRng,
  today: Date,
): Promise<PreparedRows> => {
  const startDate = addUtcDays(today, -(args.days - 1));
  const nextDailyByDate = await buildInitialDailyNumbers(organizationId, startDate, today);

  const orders: Prisma.OrderCreateManyInput[] = [];
  const orderItems: Prisma.OrderItemCreateManyInput[] = [];
  const prepTickets: Prisma.PrepTicketCreateManyInput[] = [];
  let totalRevenue = new Prisma.Decimal(0);

  const organizationMultiplier = 1 + organizationIndex * 0.24;

  for (let dayOffset = args.days - 1; dayOffset >= 0; dayOffset -= 1) {
    const dayDate = addUtcDays(today, -dayOffset);
    const dayToken = dateKey(dayDate);
    const expectedOrders = getDailyOrderCount(
      dayDate,
      args.days - dayOffset,
      organizationMultiplier,
      args,
      rng,
    );

    let nextDailyNumber = nextDailyByDate.get(dayToken) ?? 1;
    const dayStartMinutes = rng.int(7 * 60, 9 * 60);
    const dayEndMinutes = rng.int(20 * 60, 22 * 60);
    const activeMinutes = Math.max(120, dayEndMinutes - dayStartMinutes);

    for (let orderIndex = 0; orderIndex < expectedOrders; orderIndex += 1) {
      const orderId = randomUUID();
      const orderType = chooseOrderType(rng);
      const generatedItems = buildOrderItems(menuPool, rng);
      const subtotal = generatedItems.reduce((sum, item) => sum.add(item.subtotal), new Prisma.Decimal(0));
      const deliveryFee =
        orderType === OrderType.DELIVERY ? new Prisma.Decimal(rng.pick([120, 160, 200])) : new Prisma.Decimal(0);
      const total = subtotal.add(deliveryFee);

      const orderMinuteOffset = Math.round((orderIndex / Math.max(1, expectedOrders - 1)) * activeMinutes);
      const placedAt = addMinutesUtc(dayDate, dayStartMinutes + orderMinuteOffset + rng.int(0, 14));
      const paidAt = addMinutesUtc(placedAt, rng.int(8, 36));
      const closedAt = addMinutesUtc(paidAt, rng.int(1, 9));

      orders.push({
        id: orderId,
        organizationId,
        dailyNumber: nextDailyNumber,
        orderDate: dayDate,
        type: orderType,
        status: OrderStatus.CLOSED,
        tableNumber: orderType === OrderType.DINE_IN ? `T-${rng.int(1, 24)}` : null,
        notes: `${SEED_NOTE_PREFIX}${seedTag}] synthetic trend order`,
        subtotal,
        deliveryFee,
        total,
        paymentMethod: choosePaymentMethod(rng),
        paidAt,
        closedAt,
        deliveryZoneId: null,
        createdById: chooseCreatedById(userPools, rng),
        createdAt: placedAt,
        updatedAt: closedAt,
      });

      for (const item of generatedItems) {
        orderItems.push({
          id: randomUUID(),
          orderId,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          notes: null,
        });
      }

      const stations = [...new Set(generatedItems.map((item) => item.station))];
      for (const station of stations) {
        const basePrepMinutes = station === PrepStation.KITCHEN ? rng.int(9, 28) : rng.int(4, 14);
        const claimedAt = addMinutesUtc(placedAt, rng.int(1, 5));
        const readyAt = addMinutesUtc(claimedAt, basePrepMinutes);
        const stationItems = generatedItems
          .filter((item) => item.station === station)
          .map((item) => ({
            name: item.name,
            quantity: item.quantity,
            notes: null,
          }));

        prepTickets.push({
          id: randomUUID(),
          organizationId,
          orderId,
          station,
          status: PrepTicketStatus.READY,
          claimedById: chooseClaimedById(station, userPools, rng),
          claimedAt,
          readyAt,
          items: stationItems,
          createdAt: claimedAt,
          updatedAt: readyAt,
        });
      }

      nextDailyNumber += 1;
      totalRevenue = totalRevenue.add(total);
    }

    nextDailyByDate.set(dayToken, nextDailyNumber);
  }

  return {
    orders,
    orderItems,
    prepTickets,
    totalRevenue,
  };
};

const run = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  ensureSafetyGuards();
  const rng = new LcgRng(args.seed);
  const seedTag = `${Date.now()}-${args.seed}`;

  const organizations = await prisma.organization.findMany({
    where: {
      isActive: true,
      ...(args.organizationIds ? { id: { in: args.organizationIds } } : {}),
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  if (organizations.length === 0) {
    throw new Error('No active organizations found for report seeding');
  }

  if (args.reset) {
    const deleted = await prisma.order.deleteMany({
      where: {
        notes: {
          startsWith: SEED_NOTE_PREFIX,
        },
        ...(args.organizationIds ? { organizationId: { in: args.organizationIds } } : {}),
      },
    });
    console.log(`Deleted ${deleted.count} previously seeded report orders`);
  }

  const today = startOfUtcDay(new Date());
  const stats: SeedStats[] = [];

  for (let organizationIndex = 0; organizationIndex < organizations.length; organizationIndex += 1) {
    const organization = organizations[organizationIndex];
    if (!organization) {
      continue;
    }

    const userPools = await buildUserPools(organization.id);
    if (userPools.fallback.length === 0) {
      console.log(`Skipping ${organization.name}: no active users in branch`);
      continue;
    }

    const menuPool = await buildMenuPool(organization.id);
    if (menuPool.length === 0) {
      console.log(`Skipping ${organization.name}: no active menu items available`);
      continue;
    }

    console.log(`Seeding ${organization.name}...`);

    const prepared = await prepareRowsForOrganization(
      organization.id,
      organizationIndex,
      args,
      seedTag,
      userPools,
      menuPool,
      rng,
      today,
    );

    console.log(
      `  prepared ${prepared.orders.length} orders, ${prepared.orderItems.length} items, ${prepared.prepTickets.length} tickets`,
    );

    await insertInChunks(
      'orders',
      prepared.orders,
      async (chunk) => prisma.order.createMany({ data: chunk }),
      DEFAULT_CHUNK_SIZE,
    );

    await insertInChunks(
      'order_items',
      prepared.orderItems,
      async (chunk) => prisma.orderItem.createMany({ data: chunk }),
      DEFAULT_CHUNK_SIZE * 3,
    );

    await insertInChunks(
      'prep_tickets',
      prepared.prepTickets,
      async (chunk) => prisma.prepTicket.createMany({ data: chunk }),
      DEFAULT_CHUNK_SIZE * 2,
    );

    stats.push({
      organizationName: organization.name,
      ordersCreated: prepared.orders.length,
      totalRevenue: prepared.totalRevenue,
    });
  }

  const totalOrders = stats.reduce((sum, branch) => sum + branch.ordersCreated, 0);
  const grandRevenue = stats.reduce((sum, branch) => sum.add(branch.totalRevenue), new Prisma.Decimal(0));

  console.log('Report seeding complete');
  console.log(`Seed note prefix: ${SEED_NOTE_PREFIX}${seedTag}]`);
  console.log(`Date window: last ${args.days} days`);
  console.log(`Orders created: ${totalOrders}`);
  console.log(`Revenue generated: KES ${grandRevenue.toFixed(2)}`);
  for (const branch of stats) {
    console.log(`- ${branch.organizationName}: ${branch.ordersCreated} orders, KES ${branch.totalRevenue.toFixed(2)}`);
  }
};

run()
  .catch((error: unknown) => {
    console.error('Failed to seed report orders', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
