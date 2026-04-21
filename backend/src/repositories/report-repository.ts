import { OrderStatus, PrepStation, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { otherIncomeRepository } from './other-income-repository';
import { computeActualHours, computeAveragePrepMinutes, computeScheduledHours } from '../utils/report-utils';
import { formatDateOnly } from '../utils/date-only';
import type {
  BranchTrendsReport,
  BranchOverviewReport,
  DailySummaryReport,
  DirectorTrendsReport,
  DowHeatmapPoint,
  HourlyHeatmapReport,
  ItemsPerformanceReport,
  MyPerformanceReport,
  NamedSeries,
  PrepMyPerformanceReport,
  StaffPerformanceReport,
  StaffPerformanceRow,
  WaiterMyPerformanceReport,
  WaiterPaymentBreakdown,
} from '../types/report.types';

const roleOrder: Record<StaffPerformanceRow['role'], number> = {
  WAITER: 0,
  CHEF: 1,
  BARISTA: 2,
};

const roleToStation: Record<'CHEF' | 'BARISTA', PrepStation> = {
  CHEF: PrepStation.KITCHEN,
  BARISTA: PrepStation.BARISTA,
};

const toCurrencyString = (value: Prisma.Decimal | null | undefined): string => {
  return (value ?? new Prisma.Decimal(0)).toFixed(2);
};

type PaymentOrderRow = {
  paymentMethod: string | null;
  total: Prisma.Decimal;
  mpesaAmount: Prisma.Decimal | null;
  cashAmount: Prisma.Decimal | null;
  cardAmount: Prisma.Decimal | null;
  splitType: string | null;
};

const computePaymentBreakdown = (orders: PaymentOrderRow[]): WaiterPaymentBreakdown => {
  let mpesa = new Prisma.Decimal(0);
  let cash = new Prisma.Decimal(0);
  let card = new Prisma.Decimal(0);
  let houseAccount = new Prisma.Decimal(0);
  let corporateAccount = new Prisma.Decimal(0);
  let customerCredit = new Prisma.Decimal(0);

  for (const order of orders) {
    const method = order.paymentMethod;
    if (!method) continue;
    if (method === 'MPESA') {
      mpesa = mpesa.add(order.total);
    } else if (method === 'CASH') {
      cash = cash.add(order.total);
    } else if (method === 'CARD') {
      card = card.add(order.total);
    } else if (method === 'HOUSE_ACCOUNT') {
      houseAccount = houseAccount.add(order.total);
    } else if (method === 'CORPORATE_ACCOUNT') {
      corporateAccount = corporateAccount.add(order.total);
    } else if (method === 'CUSTOMER_CREDIT') {
      customerCredit = customerCredit.add(order.total);
    } else if (method === 'SPLIT') {
      if (order.mpesaAmount) mpesa = mpesa.add(order.mpesaAmount);
      if (order.cashAmount) cash = cash.add(order.cashAmount);
      if (order.cardAmount) card = card.add(order.cardAmount);
    }
  }

  // House account consumption is a staff benefit — excluded from revenue totals
  const total = mpesa.add(cash).add(card).add(corporateAccount).add(customerCredit);

  return {
    mpesa: mpesa.toFixed(2),
    cash: cash.toFixed(2),
    card: card.toFixed(2),
    houseAccount: houseAccount.toFixed(2),
    corporateAccount: corporateAccount.toFixed(2),
    customerCredit: customerCredit.toFixed(2),
    total: total.toFixed(2),
  };
};

const toNextDate = (date: Date): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
};

const getOrderDateBounds = (date: Date): { start: Date; endExclusive: Date } => {
  return {
    start: date,
    endExclusive: toNextDate(date),
  };
};

const getOrderDateRangeBounds = (startDate: Date, endDate: Date): { start: Date; endExclusive: Date } => {
  return {
    start: startDate,
    endExclusive: toNextDate(endDate),
  };
};

const buildDateRangeKeys = (startDate: Date, endDate: Date): string[] => {
  const keys: string[] = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    keys.push(formatDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
};

const toNumber = (value: Prisma.Decimal | null | undefined): number => {
  return Number.parseFloat((value ?? new Prisma.Decimal(0)).toFixed(2));
};

const toPercent = (numerator: Prisma.Decimal, denominator: Prisma.Decimal): number => {
  if (denominator.equals(0)) {
    return 0;
  }

  return Number.parseFloat(numerator.div(denominator).mul(100).toFixed(2));
};

export const reportRepository = {
  getDailySummaryByDate: async (organizationId: string, date: Date): Promise<DailySummaryReport> => {
    const { start, endExclusive } = getOrderDateBounds(date);
    const [organization, aggregate, ordersByTypeRows, paymentRows, topItemRows, prepRows, otherIncomeCategoryTotals, staffDiscountAggregate, customerDiscountAggregate] = await Promise.all([
      prisma.organization.findFirst({
        where: {
          id: organizationId,
        },
        select: {
          id: true,
          name: true,
        },
      }),
      prisma.order.aggregate({
        where: {
          organizationId,
          status: OrderStatus.CLOSED,
          orderDate: {
            gte: start,
            lt: endExclusive,
          },
          createdBy: { isTestUser: false },
          // House account orders are staff benefits — excluded from revenue
          paymentMethod: { not: 'HOUSE_ACCOUNT' },
        },
        _sum: {
          total: true,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.order.groupBy({
        by: ['type'],
        where: {
          organizationId,
          status: OrderStatus.CLOSED,
          orderDate: {
            gte: start,
            lt: endExclusive,
          },
          createdBy: { isTestUser: false },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.order.groupBy({
        by: ['paymentMethod'],
        where: {
          organizationId,
          status: OrderStatus.CLOSED,
          orderDate: {
            gte: start,
            lt: endExclusive,
          },
          paymentMethod: {
            not: null,
          },
          createdBy: { isTestUser: false },
        },
        _sum: {
          total: true,
        },
      }),
      prisma.orderItem.findMany({
        where: {
          order: {
            organizationId,
            status: OrderStatus.CLOSED,
            orderDate: {
              gte: start,
              lt: endExclusive,
            },
          },
        },
        select: {
          menuItemId: true,
          quantity: true,
          subtotal: true,
          menuItem: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.prepTicket.findMany({
        where: {
          organizationId,
          status: 'READY',
          claimedAt: {
            not: null,
          },
          readyAt: {
            not: null,
          },
          order: {
            organizationId,
            orderDate: {
              gte: start,
              lt: endExclusive,
            },
          },
        },
        select: {
          station: true,
          claimedAt: true,
          readyAt: true,
        },
      }),
      otherIncomeRepository.sumByCategory(organizationId, start, new Date(endExclusive.getTime() - 1)),
      prisma.order.aggregate({
        where: {
          organizationId,
          status: OrderStatus.CLOSED,
          orderDate: { gte: start, lt: endExclusive },
          discountAmount: { not: null },
          discountId: null, // staff discounts have no discountId FK
          createdBy: { isTestUser: false },
        },
        _sum: { discountAmount: true },
        _count: { _all: true },
      }),
      prisma.order.aggregate({
        where: {
          organizationId,
          status: OrderStatus.CLOSED,
          orderDate: { gte: start, lt: endExclusive },
          discountAmount: { not: null },
          discountId: { not: null }, // customer discounts always have a discountId FK
          createdBy: { isTestUser: false },
        },
        _sum: { discountAmount: true },
        _count: { _all: true },
      }),
    ]);

    const ordersByType: DailySummaryReport['ordersByType'] = {
      DINE_IN: 0,
      TAKE_AWAY: 0,
      DELIVERY: 0,
    };

    for (const row of ordersByTypeRows) {
      ordersByType[row.type] = row._count._all;
    }

    const revenueByPaymentMethod: DailySummaryReport['revenueByPaymentMethod'] = {
      MPESA: '0.00',
      CASH: '0.00',
      CARD: '0.00',
      SPLIT: '0.00',
      HOUSE_ACCOUNT: '0.00',
      CORPORATE_ACCOUNT: '0.00',
      CUSTOMER_CREDIT: '0.00',
    };

    for (const row of paymentRows) {
      if (!row.paymentMethod) {
        continue;
      }

      revenueByPaymentMethod[row.paymentMethod] = toCurrencyString(row._sum.total);
    }

    const topItemMap = new Map<
      string,
      {
        menuItemId: string;
        name: string;
        quantitySold: number;
        revenue: Prisma.Decimal;
      }
    >();

    for (const item of topItemRows) {
      const current = topItemMap.get(item.menuItemId);
      if (!current) {
        topItemMap.set(item.menuItemId, {
          menuItemId: item.menuItemId,
          name: item.menuItem.name,
          quantitySold: item.quantity,
          revenue: item.subtotal,
        });
        continue;
      }

      topItemMap.set(item.menuItemId, {
        ...current,
        quantitySold: current.quantitySold + item.quantity,
        revenue: current.revenue.add(item.subtotal),
      });
    }

    const topItems = [...topItemMap.values()]
      .sort((left, right) => right.quantitySold - left.quantitySold)
      .slice(0, 5)
      .map((item) => ({
        menuItemId: item.menuItemId,
        name: item.name,
        quantitySold: item.quantitySold,
        revenue: item.revenue.toFixed(2),
      }));

    const kitchenTickets = prepRows.filter((row) => row.station === PrepStation.KITCHEN);
    const baristaTickets = prepRows.filter((row) => row.station === PrepStation.BARISTA);

    const otherIncomeTotal = otherIncomeCategoryTotals.reduce(
      (acc, row) => acc.add(row.total),
      new Prisma.Decimal(0),
    );

    const grandTotal = (aggregate._sum.total ?? new Prisma.Decimal(0)).add(otherIncomeTotal);

    return {
      date: formatDateOnly(date),
      organizationId,
      organizationName: organization?.name ?? 'Unknown Branch',
      totalRevenue: grandTotal.toFixed(2),
      orderCount: aggregate._count._all,
      ordersByType,
      revenueByPaymentMethod,
      topItems,
      averagePrepTimeMinutes: {
        KITCHEN: computeAveragePrepMinutes(kitchenTickets),
        BARISTA: computeAveragePrepMinutes(baristaTickets),
      },
      otherIncomeTotal: otherIncomeTotal.toFixed(2),
      otherIncomeByCategory: otherIncomeCategoryTotals.map((row) => ({
        categoryId: row.categoryId,
        name: row.categoryName,
        total: row.total.toFixed(2),
      })),
      staffDiscountTotal: (staffDiscountAggregate._sum.discountAmount ?? new Prisma.Decimal(0)).toFixed(2),
      staffDiscountOrderCount: staffDiscountAggregate._count._all,
      customerDiscountTotal: (customerDiscountAggregate._sum.discountAmount ?? new Prisma.Decimal(0)).toFixed(2),
      customerDiscountOrderCount: customerDiscountAggregate._count._all,
    };
  },

  getStaffPerformance: async (
    organizationId: string,
    startDate: Date,
    endDate: Date,
    role?: StaffPerformanceRow['role'],
  ): Promise<StaffPerformanceReport> => {
    const { start, endExclusive } = getOrderDateRangeBounds(startDate, endDate);
    const selectedRoles: StaffPerformanceRow['role'][] = role ? [role] : ['WAITER', 'CHEF', 'BARISTA'];

    const [organization, users] = await Promise.all([
      prisma.organization.findFirst({
        where: {
          id: organizationId,
        },
        select: {
          id: true,
          name: true,
        },
      }),
      prisma.user.findMany({
        where: {
          organizationId,
          role: {
            in: selectedRoles,
          },
          isTestUser: false,
        },
        select: {
          id: true,
          name: true,
          role: true,
        },
      }),
    ]);

    if (users.length === 0) {
      return {
        period: {
          startDate: formatDateOnly(startDate),
          endDate: formatDateOnly(endDate),
        },
        organizationId,
        organizationName: organization?.name ?? 'Unknown Branch',
        staff: [],
      };
    }

    const userIds = users.map((user) => user.id);
    const waiterIds = users.filter((user) => user.role === 'WAITER').map((user) => user.id);
    const prepUserIds = users
      .filter((user) => user.role === 'CHEF' || user.role === 'BARISTA')
      .map((user) => user.id);

    const [waiterRows, prepRows, assignmentRows, clockRows, waiterPaymentOrders] = await Promise.all([
      waiterIds.length === 0
        ? Promise.resolve([])
        : prisma.order.groupBy({
            by: ['createdById'],
            where: {
              organizationId,
              status: OrderStatus.CLOSED,
              createdById: {
                in: waiterIds,
              },
              orderDate: {
                gte: start,
                lt: endExclusive,
              },
              createdBy: { isTestUser: false },
            },
            _count: {
              _all: true,
            },
            _avg: {
              total: true,
            },
          }),
      prepUserIds.length === 0
        ? Promise.resolve([])
        : prisma.prepTicket.findMany({
            where: {
              organizationId,
              status: 'READY',
              claimedById: {
                in: prepUserIds,
              },
              claimedAt: {
                not: null,
              },
              readyAt: {
                not: null,
              },
              order: {
                orderDate: {
                  gte: start,
                  lt: endExclusive,
                },
              },
            },
            select: {
              claimedById: true,
              station: true,
              claimedAt: true,
              readyAt: true,
            },
          }),
      prisma.shiftAssignment.findMany({
        where: {
          organizationId,
          userId: {
            in: userIds,
          },
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          userId: true,
          shift: {
            select: {
              startTime: true,
              endTime: true,
            },
          },
        },
      }),
      prisma.clockRecord.findMany({
        where: {
          organizationId,
          userId: {
            in: userIds,
          },
          shiftAssignment: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        select: {
          userId: true,
          clockInAt: true,
          clockOutAt: true,
        },
      }),
      waiterIds.length === 0
        ? Promise.resolve([])
        : prisma.order.findMany({
            where: {
              organizationId,
              status: OrderStatus.CLOSED,
              createdById: { in: waiterIds },
              orderDate: { gte: start, lt: endExclusive },
              createdBy: { isTestUser: false },
            },
            select: {
              createdById: true,
              paymentMethod: true,
              total: true,
              mpesaAmount: true,
              cashAmount: true,
              cardAmount: true,
              splitType: true,
            },
          }),
    ]);

    const waiterStats = new Map<
      string,
      {
        ordersHandled: number;
        averageOrderValue: string;
      }
    >();

    for (const row of waiterRows) {
      waiterStats.set(row.createdById, {
        ordersHandled: row._count._all,
        averageOrderValue: toCurrencyString(row._avg.total),
      });
    }

    const prepStats = new Map<string, { station: PrepStation; claimedAt: Date | null; readyAt: Date | null }[]>();
    for (const row of prepRows) {
      if (!row.claimedById) {
        continue;
      }

      const current = prepStats.get(row.claimedById) ?? [];
      current.push({
        station: row.station,
        claimedAt: row.claimedAt,
        readyAt: row.readyAt,
      });
      prepStats.set(row.claimedById, current);
    }

    const scheduledByUser = new Map<string, typeof assignmentRows>();
    for (const assignment of assignmentRows) {
      const current = scheduledByUser.get(assignment.userId) ?? [];
      current.push(assignment);
      scheduledByUser.set(assignment.userId, current);
    }

    const actualByUser = new Map<string, typeof clockRows>();
    for (const clock of clockRows) {
      const current = actualByUser.get(clock.userId) ?? [];
      current.push(clock);
      actualByUser.set(clock.userId, current);
    }

    const paymentOrdersByWaiter = new Map<string, PaymentOrderRow[]>();
    for (const order of waiterPaymentOrders) {
      const current = paymentOrdersByWaiter.get(order.createdById) ?? [];
      current.push(order);
      paymentOrdersByWaiter.set(order.createdById, current);
    }

    const staff: StaffPerformanceRow[] = users.map((user) => {
      const scheduledHours = computeScheduledHours(
        (scheduledByUser.get(user.id) ?? []).map((assignment) => ({
          shift: assignment.shift,
        })),
      );

      const actualHours = computeActualHours(
        (actualByUser.get(user.id) ?? []).map((clock) => ({
          clockInAt: clock.clockInAt,
          clockOutAt: clock.clockOutAt,
        })),
      );

      if (user.role === 'WAITER') {
        const waiter = waiterStats.get(user.id);
        return {
          id: user.id,
          name: user.name,
          role: 'WAITER',
          ordersHandled: waiter?.ordersHandled ?? 0,
          averageOrderValue: waiter?.averageOrderValue ?? '0.00',
          averagePrepTimeMinutes: null,
          scheduledHours,
          actualHours,
          paymentBreakdown: computePaymentBreakdown(paymentOrdersByWaiter.get(user.id) ?? []),
        };
      }

      const station = roleToStation[user.role as 'CHEF' | 'BARISTA'];
      const userTickets = (prepStats.get(user.id) ?? []).filter((ticket) => ticket.station === station);

      return {
        id: user.id,
        name: user.name,
        role: user.role as StaffPerformanceRow['role'],
        ordersHandled: userTickets.length,
        averageOrderValue: null,
        averagePrepTimeMinutes: computeAveragePrepMinutes(userTickets),
        scheduledHours,
        actualHours,
        paymentBreakdown: null,
      };
    });

    staff.sort((left, right) => {
      const roleCompare = roleOrder[left.role] - roleOrder[right.role];
      if (roleCompare !== 0) {
        return roleCompare;
      }

      return left.name.localeCompare(right.name);
    });

    return {
      period: {
        startDate: formatDateOnly(startDate),
        endDate: formatDateOnly(endDate),
      },
      organizationId,
      organizationName: organization?.name ?? 'Unknown Branch',
      staff,
    };
  },

  getBranchOverview: async (startDate: Date, endDate: Date): Promise<BranchOverviewReport> => {
    const { start, endExclusive } = getOrderDateRangeBounds(startDate, endDate);
    const organizations = await prisma.organization.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    const branchResults = await Promise.all(
      organizations.map(async (organization) => {
        const [orderAggregate, prepRows, paymentOrders, otherIncomeRows, staffDiscountAgg, customerDiscountAgg] = await Promise.all([
          prisma.order.aggregate({
            where: {
              organizationId: organization.id,
              status: OrderStatus.CLOSED,
              orderDate: {
                gte: start,
                lt: endExclusive,
              },
              createdBy: { isTestUser: false },
              // House account orders are staff benefits — excluded from revenue
              paymentMethod: { not: 'HOUSE_ACCOUNT' },
            },
            _sum: {
              total: true,
            },
            _count: {
              _all: true,
            },
          }),
          prisma.prepTicket.findMany({
            where: {
              organizationId: organization.id,
              status: 'READY',
              claimedAt: {
                not: null,
              },
              readyAt: {
                not: null,
              },
              order: {
                orderDate: {
                  gte: start,
                  lt: endExclusive,
                },
              },
            },
            select: {
              station: true,
              claimedAt: true,
              readyAt: true,
            },
          }),
          prisma.order.findMany({
            where: {
              organizationId: organization.id,
              status: OrderStatus.CLOSED,
              orderDate: {
                gte: start,
                lt: endExclusive,
              },
              createdBy: { isTestUser: false },
            },
            select: {
              paymentMethod: true,
              total: true,
              mpesaAmount: true,
              cashAmount: true,
              cardAmount: true,
              splitType: true,
            },
          }),
          otherIncomeRepository.sumByCategory(organization.id, startDate, endDate),
          prisma.order.aggregate({
            where: {
              organizationId: organization.id,
              status: OrderStatus.CLOSED,
              orderDate: { gte: start, lt: endExclusive },
              discountAmount: { not: null },
              discountId: null,
              createdBy: { isTestUser: false },
            },
            _sum: { discountAmount: true },
          }),
          prisma.order.aggregate({
            where: {
              organizationId: organization.id,
              status: OrderStatus.CLOSED,
              orderDate: { gte: start, lt: endExclusive },
              discountAmount: { not: null },
              discountId: { not: null },
              createdBy: { isTestUser: false },
            },
            _sum: { discountAmount: true },
          }),
        ]);

        const orderRevenueDecimal = orderAggregate._sum.total ?? new Prisma.Decimal(0);
        const otherIncomeDecimal = otherIncomeRows.reduce(
          (sum, row) => sum.add(row.total),
          new Prisma.Decimal(0),
        );
        const revenueDecimal = orderRevenueDecimal.add(otherIncomeDecimal);
        const kitchenTickets = prepRows.filter((ticket) => ticket.station === PrepStation.KITCHEN);
        const baristaTickets = prepRows.filter((ticket) => ticket.station === PrepStation.BARISTA);

        const staffDiscountDecimal = staffDiscountAgg._sum.discountAmount ?? new Prisma.Decimal(0);
        const customerDiscountDecimal = customerDiscountAgg._sum.discountAmount ?? new Prisma.Decimal(0);

        return {
          revenueDecimal,
          otherIncomeDecimal,
          orderCount: orderAggregate._count._all,
          branch: {
            id: organization.id,
            name: organization.name,
            revenue: revenueDecimal.toFixed(2),
            otherIncomeTotal: otherIncomeDecimal.toFixed(2),
            staffDiscountTotal: staffDiscountDecimal.toFixed(2),
            customerDiscountTotal: customerDiscountDecimal.toFixed(2),
            orderCount: orderAggregate._count._all,
            averagePrepTimeMinutes: {
              KITCHEN: computeAveragePrepMinutes(kitchenTickets),
              BARISTA: computeAveragePrepMinutes(baristaTickets),
            },
            paymentBreakdown: computePaymentBreakdown(paymentOrders),
          },
        };
      }),
    );

    const totalRevenueDecimal = branchResults.reduce(
      (sum, result) => sum.add(result.revenueDecimal),
      new Prisma.Decimal(0),
    );
    const totalOtherIncomeDecimal = branchResults.reduce(
      (sum, result) => sum.add(result.otherIncomeDecimal),
      new Prisma.Decimal(0),
    );

    const totalOrders = branchResults.reduce((sum, result) => sum + result.orderCount, 0);

    return {
      period: {
        startDate: formatDateOnly(startDate),
        endDate: formatDateOnly(endDate),
      },
      totalRevenue: totalRevenueDecimal.toFixed(2),
      totalOtherIncome: totalOtherIncomeDecimal.toFixed(2),
      totalOrders,
      branches: branchResults.map((result) => result.branch),
    };
  },

  getBranchTrends: async (
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<BranchTrendsReport> => {
    const { start, endExclusive } = getOrderDateRangeBounds(startDate, endDate);
    const dateKeys = buildDateRangeKeys(startDate, endDate);

    const [organization, orders, prepRows] = await Promise.all([
      prisma.organization.findFirst({
        where: {
          id: organizationId,
        },
        select: {
          id: true,
          name: true,
        },
      }),
      prisma.order.findMany({
        where: {
          organizationId,
          status: OrderStatus.CLOSED,
          orderDate: {
            gte: start,
            lt: endExclusive,
          },
          createdBy: { isTestUser: false },
          // House account orders are staff benefits — excluded from revenue
          paymentMethod: { not: 'HOUSE_ACCOUNT' },
        },
        select: {
          orderDate: true,
          total: true,
        },
      }),
      prisma.prepTicket.findMany({
        where: {
          organizationId,
          status: 'READY',
          claimedAt: {
            not: null,
          },
          readyAt: {
            not: null,
          },
          order: {
            organizationId,
            orderDate: {
              gte: start,
              lt: endExclusive,
            },
          },
        },
        select: {
          station: true,
          claimedAt: true,
          readyAt: true,
          order: {
            select: {
              orderDate: true,
            },
          },
        },
      }),
    ]);

    const orderCountByDate = new Map<string, number>();
    const revenueByDate = new Map<string, Prisma.Decimal>();

    for (const order of orders) {
      const dateKey = formatDateOnly(order.orderDate);
      orderCountByDate.set(dateKey, (orderCountByDate.get(dateKey) ?? 0) + 1);
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) ?? new Prisma.Decimal(0)).add(order.total));
    }

    const kitchenTicketsByDate = new Map<string, Array<{ claimedAt: Date | null; readyAt: Date | null }>>();
    const baristaTicketsByDate = new Map<string, Array<{ claimedAt: Date | null; readyAt: Date | null }>>();
    const allTicketsByDate = new Map<string, Array<{ claimedAt: Date | null; readyAt: Date | null }>>();

    for (const row of prepRows) {
      const dateKey = formatDateOnly(row.order.orderDate);
      const ticket = {
        claimedAt: row.claimedAt,
        readyAt: row.readyAt,
      };

      const allCurrent = allTicketsByDate.get(dateKey) ?? [];
      allCurrent.push(ticket);
      allTicketsByDate.set(dateKey, allCurrent);

      if (row.station === PrepStation.KITCHEN) {
        const kitchenCurrent = kitchenTicketsByDate.get(dateKey) ?? [];
        kitchenCurrent.push(ticket);
        kitchenTicketsByDate.set(dateKey, kitchenCurrent);
      } else {
        const baristaCurrent = baristaTicketsByDate.get(dateKey) ?? [];
        baristaCurrent.push(ticket);
        baristaTicketsByDate.set(dateKey, baristaCurrent);
      }
    }

    return {
      period: {
        startDate: formatDateOnly(startDate),
        endDate: formatDateOnly(endDate),
      },
      organizationId,
      organizationName: organization?.name ?? 'Unknown Branch',
      points: dateKeys.map((date) => ({
        date,
        orders: orderCountByDate.get(date) ?? 0,
        revenue: toCurrencyString(revenueByDate.get(date)),
        avgPrepKitchen: computeAveragePrepMinutes(kitchenTicketsByDate.get(date) ?? []),
        avgPrepBarista: computeAveragePrepMinutes(baristaTicketsByDate.get(date) ?? []),
        avgPrepCombined: computeAveragePrepMinutes(allTicketsByDate.get(date) ?? []),
      })),
    };
  },

  getDirectorTrends: async (startDate: Date, endDate: Date): Promise<DirectorTrendsReport> => {
    const { start, endExclusive } = getOrderDateRangeBounds(startDate, endDate);
    const dateKeys = buildDateRangeKeys(startDate, endDate);

    const organizations = await prisma.organization.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    const organizationIds = organizations.map((organization) => organization.id);
    if (organizationIds.length === 0) {
      return {
        period: {
          startDate: formatDateOnly(startDate),
          endDate: formatDateOnly(endDate),
        },
        aggregateSeries: dateKeys.map((date) => ({
          date,
          totalRevenue: '0.00',
          totalOrders: 0,
        })),
        branchRevenueSeries: [],
        branchOrdersSeries: [],
        branchContributionSeries: [],
        itemFamilySeries: [],
        branches: [],
      };
    }

    const [orders, categoryRows, otherIncomeEntries] = await Promise.all([
      prisma.order.findMany({
        where: {
          organizationId: {
            in: organizationIds,
          },
          status: OrderStatus.CLOSED,
          orderDate: {
            gte: start,
            lt: endExclusive,
          },
          createdBy: { isTestUser: false },
          // House account orders are staff benefits — excluded from revenue
          paymentMethod: { not: 'HOUSE_ACCOUNT' },
        },
        select: {
          organizationId: true,
          orderDate: true,
          total: true,
        },
      }),
      prisma.orderItem.findMany({
        where: {
          order: {
            organizationId: {
              in: organizationIds,
            },
            status: OrderStatus.CLOSED,
            orderDate: {
              gte: start,
              lt: endExclusive,
            },
          },
        },
        select: {
          subtotal: true,
          order: {
            select: {
              orderDate: true,
            },
          },
          menuItem: {
            select: {
              category: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.otherIncomeEntry.findMany({
        where: {
          organizationId: { in: organizationIds },
          entryDate: { gte: start, lt: endExclusive },
        },
        select: {
          organizationId: true,
          entryDate: true,
          amount: true,
        },
      }),
    ]);

    const dailyRevenue = new Map<string, Prisma.Decimal>();
    const dailyOrders = new Map<string, number>();
    const branchRevenue = new Map<string, Map<string, Prisma.Decimal>>();
    const branchOrders = new Map<string, Map<string, number>>();

    for (const organization of organizations) {
      branchRevenue.set(organization.id, new Map<string, Prisma.Decimal>());
      branchOrders.set(organization.id, new Map<string, number>());
    }

    for (const order of orders) {
      const dateKey = formatDateOnly(order.orderDate);

      dailyOrders.set(dateKey, (dailyOrders.get(dateKey) ?? 0) + 1);
      dailyRevenue.set(dateKey, (dailyRevenue.get(dateKey) ?? new Prisma.Decimal(0)).add(order.total));

      const revenueMap = branchRevenue.get(order.organizationId) ?? new Map<string, Prisma.Decimal>();
      revenueMap.set(dateKey, (revenueMap.get(dateKey) ?? new Prisma.Decimal(0)).add(order.total));
      branchRevenue.set(order.organizationId, revenueMap);

      const orderMap = branchOrders.get(order.organizationId) ?? new Map<string, number>();
      orderMap.set(dateKey, (orderMap.get(dateKey) ?? 0) + 1);
      branchOrders.set(order.organizationId, orderMap);
    }

    for (const entry of otherIncomeEntries) {
      const dateKey = formatDateOnly(entry.entryDate);
      dailyRevenue.set(dateKey, (dailyRevenue.get(dateKey) ?? new Prisma.Decimal(0)).add(entry.amount));
      const revenueMap = branchRevenue.get(entry.organizationId) ?? new Map<string, Prisma.Decimal>();
      revenueMap.set(dateKey, (revenueMap.get(dateKey) ?? new Prisma.Decimal(0)).add(entry.amount));
      branchRevenue.set(entry.organizationId, revenueMap);
    }

    const categoryTotals = new Map<string, Prisma.Decimal>();
    const categoryByDate = new Map<string, Map<string, Prisma.Decimal>>();

    for (const row of categoryRows) {
      const categoryName = row.menuItem.category.name;
      const dateKey = formatDateOnly(row.order.orderDate);

      categoryTotals.set(categoryName, (categoryTotals.get(categoryName) ?? new Prisma.Decimal(0)).add(row.subtotal));

      const byDate = categoryByDate.get(categoryName) ?? new Map<string, Prisma.Decimal>();
      byDate.set(dateKey, (byDate.get(dateKey) ?? new Prisma.Decimal(0)).add(row.subtotal));
      categoryByDate.set(categoryName, byDate);
    }

    const branchRevenueSeries: NamedSeries[] = organizations.map((organization) => {
      const byDate = branchRevenue.get(organization.id) ?? new Map<string, Prisma.Decimal>();
      return {
        id: organization.id,
        name: organization.name,
        points: dateKeys.map((date) => ({
          date,
          value: toNumber(byDate.get(date)),
        })),
      };
    });

    const branchOrdersSeries: NamedSeries[] = organizations.map((organization) => {
      const byDate = branchOrders.get(organization.id) ?? new Map<string, number>();
      return {
        id: organization.id,
        name: organization.name,
        points: dateKeys.map((date) => ({
          date,
          value: byDate.get(date) ?? 0,
        })),
      };
    });

    const topFamilies = [...categoryTotals.entries()]
      .sort((left, right) => {
        if (left[1].equals(right[1])) {
          return 0;
        }

        return left[1].lessThan(right[1]) ? 1 : -1;
      })
      .slice(0, 5);

    return {
      period: {
        startDate: formatDateOnly(startDate),
        endDate: formatDateOnly(endDate),
      },
      aggregateSeries: dateKeys.map((date) => ({
        date,
        totalRevenue: toCurrencyString(dailyRevenue.get(date)),
        totalOrders: dailyOrders.get(date) ?? 0,
      })),
      branchRevenueSeries,
      branchOrdersSeries,
      branchContributionSeries: organizations.map((organization) => {
        const revenueByDate = branchRevenue.get(organization.id) ?? new Map<string, Prisma.Decimal>();
        return {
          id: organization.id,
          name: organization.name,
          points: dateKeys.map((date) => ({
            date,
            value: toPercent(
              revenueByDate.get(date) ?? new Prisma.Decimal(0),
              dailyRevenue.get(date) ?? new Prisma.Decimal(0),
            ),
          })),
        };
      }),
      itemFamilySeries: topFamilies.map(([categoryName]) => {
        const byDate = categoryByDate.get(categoryName) ?? new Map<string, Prisma.Decimal>();
        return {
          id: categoryName,
          name: categoryName,
          points: dateKeys.map((date) => ({
            date,
            value: toNumber(byDate.get(date)),
          })),
        };
      }),
      branches: organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
      })),
    };
  },

  getMyPerformance: async (
    userId: string,
    organizationId: string,
    role: 'WAITER' | 'CHEF' | 'BARISTA',
    startDate: Date,
    endDate: Date,
  ): Promise<MyPerformanceReport> => {
    const { start, endExclusive } = getOrderDateRangeBounds(startDate, endDate);
    const dateKeys = buildDateRangeKeys(startDate, endDate);

    if (role === 'WAITER') {
      const orders = await prisma.order.findMany({
        where: {
          organizationId,
          status: OrderStatus.CLOSED,
          createdById: userId,
          orderDate: {
            gte: start,
            lt: endExclusive,
          },
          createdBy: { isTestUser: false },
          // House account orders are staff benefits — excluded from revenue
          paymentMethod: { not: 'HOUSE_ACCOUNT' },
        },
        select: {
          orderDate: true,
          total: true,
          paymentMethod: true,
          mpesaAmount: true,
          cashAmount: true,
          cardAmount: true,
          splitType: true,
          items: {
            select: {
              quantity: true,
              menuItem: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      const byDate = new Map<string, number>();
      const topItemMap = new Map<string, number>();
      let totalRevenue = new Prisma.Decimal(0);

      for (const order of orders) {
        totalRevenue = totalRevenue.add(order.total);
        const key = formatDateOnly(order.orderDate);
        byDate.set(key, (byDate.get(key) ?? 0) + 1);

        for (const item of order.items) {
          topItemMap.set(item.menuItem.name, (topItemMap.get(item.menuItem.name) ?? 0) + item.quantity);
        }
      }

      let busiestDay: string | null = null;
      let busiestCount = 0;
      for (const [dateKey, count] of byDate.entries()) {
        if (count > busiestCount) {
          busiestCount = count;
          busiestDay = dateKey;
        }
      }

      const ordersOverTime = dateKeys.map((dateKey) => ({
        date: dateKey,
        count: byDate.get(dateKey) ?? 0,
      }));

      const topItems = [...topItemMap.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([name, quantitySold]) => ({
          name,
          quantitySold,
        }));

      const ordersHandled = orders.length;
      const averageOrderValue =
        ordersHandled === 0
          ? new Prisma.Decimal(0)
          : totalRevenue.div(new Prisma.Decimal(ordersHandled));

      const waiterReport: WaiterMyPerformanceReport = {
        role: 'WAITER',
        period: {
          startDate: formatDateOnly(startDate),
          endDate: formatDateOnly(endDate),
        },
        ordersHandled,
        averageOrderValue: averageOrderValue.toFixed(2),
        totalRevenueGenerated: totalRevenue.toFixed(2),
        busiestDay,
        ordersOverTime,
        topItems,
        paymentBreakdown: computePaymentBreakdown(orders),
      };

      return waiterReport;
    }

    const station = roleToStation[role];
    const tickets = await prisma.prepTicket.findMany({
      where: {
        organizationId,
        claimedById: userId,
        station,
        status: 'READY',
        claimedAt: {
          not: null,
        },
        readyAt: {
          not: null,
        },
        order: {
          orderDate: {
            gte: start,
            lt: endExclusive,
          },
        },
      },
      select: {
        claimedAt: true,
        readyAt: true,
        order: {
          select: {
            orderDate: true,
          },
        },
      },
    });

    const byDateCount = new Map<string, number>();

    let fastestPrepTimeMinutes = Number.POSITIVE_INFINITY;

    for (const ticket of tickets) {
      if (!ticket.claimedAt || !ticket.readyAt) {
        continue;
      }

      const minutes = Math.max(0, Math.round((ticket.readyAt.getTime() - ticket.claimedAt.getTime()) / 60000));
      const dateKey = formatDateOnly(ticket.order.orderDate);
      byDateCount.set(dateKey, (byDateCount.get(dateKey) ?? 0) + 1);

      if (minutes < fastestPrepTimeMinutes) {
        fastestPrepTimeMinutes = minutes;
      }
    }

    let busiestDay: string | null = null;
    let busiestCount = 0;
    for (const [dateKey, count] of byDateCount.entries()) {
      if (count > busiestCount) {
        busiestCount = count;
        busiestDay = dateKey;
      }
    }

    const ordersOverTime = dateKeys.map((dateKey) => ({
      date: dateKey,
      count: byDateCount.get(dateKey) ?? 0,
    }));

    const prepReport: PrepMyPerformanceReport = {
      role,
      period: {
        startDate: formatDateOnly(startDate),
        endDate: formatDateOnly(endDate),
      },
      ticketsCompleted: tickets.length,
      averagePrepTimeMinutes: computeAveragePrepMinutes(tickets),
      fastestPrepTimeMinutes:
        fastestPrepTimeMinutes === Number.POSITIVE_INFINITY ? 0 : fastestPrepTimeMinutes,
      busiestDay,
      ordersOverTime,
    };

    return prepReport;
  },

  listActiveOrganizations: async (): Promise<Array<{ id: string; name: string }>> => {
    return prisma.organization.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  },

  getDailySummaryInRange: async (
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailySummaryReport[]> => {
    const summaries: DailySummaryReport[] = [];
    const cursor = new Date(startDate);

    while (cursor <= endDate) {
      summaries.push(await reportRepository.getDailySummaryByDate(organizationId, cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return summaries;
  },

  getDirectorPulse: async (): Promise<import('../types/report.types').DirectorPulseReport> => {
    const organizations = await prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const now = new Date();

    const branchResults = await Promise.all(
      organizations.map(async (organization) => {
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        // Start of today in Africa/Nairobi (UTC+3)
        const startOfTodayNairobi = new Date(now);
        startOfTodayNairobi.setUTCHours(startOfTodayNairobi.getUTCHours() - 3); // shift to Nairobi local
        startOfTodayNairobi.setUTCHours(0, 0, 0, 0); // midnight local
        const startOfTodayUtc = new Date(startOfTodayNairobi.getTime() + 3 * 60 * 60 * 1000); // back to UTC

        const [activeOrders, tickets, clockedInRecords, lateOrderRows] = await Promise.all([
          prisma.order.count({
            where: {
              organizationId: organization.id,
              status: { in: ['PENDING', 'IN_PROGRESS', 'READY'] },
              createdAt: { gte: startOfTodayUtc },
            },
          }),
          prisma.prepTicket.groupBy({
            by: ['status'],
            where: {
              organizationId: organization.id,
              status: { in: ['PENDING', 'IN_PROGRESS'] },
            },
            _count: { _all: true },
          }),
          prisma.clockRecord.findMany({
            where: {
              organizationId: organization.id,
              clockInAt: { not: null },
              clockOutAt: null,
            },
            select: {
              user: { select: { name: true, role: true } },
            },
          }),
          // READY orders created today that have been unclosed for more than 2 hours
          prisma.order.findMany({
            where: {
              organizationId: organization.id,
              status: 'READY',
              createdAt: { gte: startOfTodayUtc },
              updatedAt: { lt: twoHoursAgo },
            },
            select: {
              id: true,
              dailyNumber: true,
              total: true,
              updatedAt: true,
              createdBy: { select: { name: true } },
            },
            orderBy: { updatedAt: 'asc' },
          }),
        ]);

        const pendingTickets =
          tickets.find((ticket) => ticket.status === 'PENDING')?._count._all ?? 0;
        const inProgressTickets =
          tickets.find((ticket) => ticket.status === 'IN_PROGRESS')?._count._all ?? 0;

        return {
          id: organization.id,
          name: organization.name,
          activeOrders,
          pendingTickets,
          inProgressTickets,
          clockedInCount: clockedInRecords.length,
          clockedInStaff: clockedInRecords.map((record) => ({
            name: record.user.name,
            role: record.user.role,
          })),
          lateOrderCount: lateOrderRows.length,
          lateOrders: lateOrderRows.map((order) => ({
            id: order.id,
            dailyNumber: order.dailyNumber,
            total: order.total.toString(),
            ageMinutes: Math.floor((now.getTime() - order.updatedAt.getTime()) / 60_000),
            waiterName: order.createdBy.name,
          })),
        };
      }),
    );

    return {
      asOf: now.toISOString(),
      totalActiveOrders: branchResults.reduce((sum, branch) => sum + branch.activeOrders, 0),
      totalClockedIn: branchResults.reduce((sum, branch) => sum + branch.clockedInCount, 0),
      branches: branchResults,
    };
  },

  getPrepRowsByReadyAtRange: async (organizationId: string, date: Date) => {
    const nextDate = toNextDate(date);
    return prisma.prepTicket.findMany({
      where: {
        organizationId,
        status: 'READY',
        claimedAt: {
          not: null,
        },
        readyAt: {
          gte: date,
          lt: nextDate,
        },
      },
      select: {
        station: true,
        claimedAt: true,
        readyAt: true,
      },
    });
  },

  getHourlyHeatmap: async (
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<HourlyHeatmapReport> => {
    const { start, endExclusive } = getOrderDateRangeBounds(startDate, endDate);

    const [organization, orders] = await Promise.all([
      prisma.organization.findFirst({
        where: { id: organizationId },
        select: { id: true, name: true },
      }),
      prisma.order.findMany({
        where: {
          organizationId,
          createdAt: { gte: start, lt: endExclusive },
          status: { not: 'CANCELLED' },
          createdBy: { isTestUser: false },
        },
        select: { createdAt: true, type: true },
      }),
    ]);

    const nairobiFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Nairobi',
      hour: 'numeric',
      hour12: false,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const countByHour = new Array<number>(24).fill(0);
    const dineInByHour = new Array<number>(24).fill(0);
    const takeAwayByHour = new Array<number>(24).fill(0);
    const deliveryByHour = new Array<number>(24).fill(0);
    const dowTotals = new Array<number>(7).fill(0);
    // Track distinct calendar dates seen per day-of-week for averaging
    const dowDateSets: Set<string>[] = Array.from({ length: 7 }, () => new Set<string>());

    for (const order of orders) {
      const parts = nairobiFormatter.formatToParts(order.createdAt);
      const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '0';
      const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
      const year = parts.find((p) => p.type === 'year')?.value ?? '';
      const month = parts.find((p) => p.type === 'month')?.value ?? '';
      const day = parts.find((p) => p.type === 'day')?.value ?? '';

      const hour = parseInt(hourStr, 10);
      const dow = dowLabels.indexOf(weekdayStr);
      const dateKey = `${year}-${month}-${day}`;

      if (hour >= 0 && hour < 24) {
        countByHour[hour] = (countByHour[hour] ?? 0) + 1;
        if (order.type === 'DINE_IN') {
          dineInByHour[hour] = (dineInByHour[hour] ?? 0) + 1;
        } else if (order.type === 'TAKE_AWAY') {
          takeAwayByHour[hour] = (takeAwayByHour[hour] ?? 0) + 1;
        } else if (order.type === 'DELIVERY') {
          deliveryByHour[hour] = (deliveryByHour[hour] ?? 0) + 1;
        }
      }

      if (dow >= 0) {
        dowTotals[dow] = (dowTotals[dow] ?? 0) + 1;
        dowDateSets[dow]?.add(dateKey);
      }
    }

    const hourLabel = (hour: number): string => {
      if (hour === 0) return '12am';
      if (hour < 12) return `${String(hour)}am`;
      if (hour === 12) return '12pm';
      return `${String(hour - 12)}pm`;
    };

    const hourlyPoints = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: hourLabel(hour),
      orderCount: countByHour[hour] ?? 0,
      byType: {
        DINE_IN: dineInByHour[hour] ?? 0,
        TAKE_AWAY: takeAwayByHour[hour] ?? 0,
        DELIVERY: deliveryByHour[hour] ?? 0,
      },
    }));

    // Re-order DOW: Mon–Sun (business-friendly week start)
    const dowOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon=1..Sat=6, Sun=0
    const dowPoints: DowHeatmapPoint[] = dowOrder.map((dow) => {
      const dayCount = dowDateSets[dow]?.size ?? 0;
      return {
        dow,
        label: dowLabels[dow] ?? '',
        avgOrderCount: dayCount > 0 ? Math.round((dowTotals[dow] ?? 0) / dayCount) : 0,
      };
    });

    return {
      period: {
        startDate: formatDateOnly(startDate),
        endDate: formatDateOnly(endDate),
      },
      organizationId,
      organizationName: organization?.name ?? 'Unknown Branch',
      hourlyPoints,
      dowPoints,
    };
  },

  getOutstandingBalances: async (organizationId?: string) => {
    const [houseAccounts, corporateAccounts, customerCreditAccounts] = await Promise.all([
      prisma.houseAccount.findMany({
        where: { isActive: true, currentBalance: { gt: 0 } },
        select: {
          id: true,
          userId: true,
          currentBalance: true,
          creditLimit: true,
          user: { select: { name: true, role: true } },
        },
        orderBy: { currentBalance: 'desc' },
      }),
      prisma.corporateAccount.findMany({
        where: { isActive: true, currentBalance: { gt: 0 } },
        select: {
          id: true,
          companyName: true,
          contactName: true,
          contactPhone: true,
          currentBalance: true,
          creditLimit: true,
        },
        orderBy: { currentBalance: 'desc' },
      }),
      prisma.customerCreditAccount.findMany({
        where: {
          isActive: true,
          currentBalance: { gt: 0 },
          ...(organizationId ? { organizationId } : {}),
        },
        select: {
          id: true,
          organizationId: true,
          customerName: true,
          customerPhone: true,
          currentBalance: true,
          creditLimit: true,
          organization: { select: { name: true } },
        },
        orderBy: { currentBalance: 'desc' },
      }),
    ]);

    return { houseAccounts, corporateAccounts, customerCreditAccounts };
  },

  getItemsPerformance: async (
    organizationId: string | null,
    startDate: Date,
    endDate: Date,
    limit: number,
  ): Promise<ItemsPerformanceReport> => {
    const { start, endExclusive } = getOrderDateRangeBounds(startDate, endDate);

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          ...(organizationId ? { organizationId } : {}),
          createdAt: { gte: start, lt: endExclusive },
          status: { not: 'CANCELLED' },
          createdBy: { isTestUser: false },
        },
      },
      select: {
        quantity: true,
        unitPrice: true,
        menuItem: {
          select: {
            id: true,
            name: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    let organizationName = 'All Branches';
    if (organizationId) {
      const org = await prisma.organization.findFirst({
        where: { id: organizationId },
        select: { name: true },
      });
      organizationName = org?.name ?? 'Unknown Branch';
    }

    // Aggregate by menuItemId
    const map = new Map<string, { menuItemId: string; name: string; categoryName: string; quantity: number; revenue: Prisma.Decimal }>();

    for (const item of orderItems) {
      const id = item.menuItem.id;
      const existing = map.get(id);
      const lineRevenue = item.unitPrice.mul(item.quantity);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue = existing.revenue.add(lineRevenue);
      } else {
        map.set(id, {
          menuItemId: id,
          name: item.menuItem.name,
          categoryName: item.menuItem.category?.name ?? 'Uncategorised',
          quantity: item.quantity,
          revenue: lineRevenue,
        });
      }
    }

    const sorted = [...map.values()].sort((a, b) => b.quantity - a.quantity);

    const toRow = (entry: (typeof sorted)[number]) => ({
      menuItemId: entry.menuItemId,
      name: entry.name,
      categoryName: entry.categoryName,
      quantitySold: entry.quantity,
      revenue: entry.revenue.toFixed(2),
    });

    // limit=0 means "return all items" as a single ranked list (topItems), bottomItems empty
    const showAll = limit === 0;
    const topItems = showAll ? sorted.map(toRow) : sorted.slice(0, limit).map(toRow);
    const bottomItems = showAll
      ? []
      : [...sorted]
          .reverse()
          .filter((e) => !topItems.some((t) => t.menuItemId === e.menuItemId))
          .slice(0, limit)
          .map(toRow);

    return {
      period: {
        startDate: formatDateOnly(startDate),
        endDate: formatDateOnly(endDate),
      },
      organizationId,
      organizationName,
      topItems,
      bottomItems,
      limit,
    };
  },

  getAccountantReconciliation: async (
    organizationId: string,
    date: Date,
  ): Promise<import('../types/report.types').AccountantReconciliationReport> => {
    const { start, endExclusive } = getOrderDateBounds(date);

    const [organization, orders] = await Promise.all([
      prisma.organization.findFirst({
        where: { id: organizationId },
        select: { id: true, name: true },
      }),
      prisma.order.findMany({
        where: {
          organizationId,
          status: OrderStatus.CLOSED,
          orderDate: { gte: start, lt: endExclusive },
          createdBy: { isTestUser: false },
        },
        select: {
          id: true,
          dailyNumber: true,
          paidAt: true,
          total: true,
          paymentMethod: true,
          mpesaCode: true,
          mpesaAmount: true,
          cashAmount: true,
          cardAmount: true,
          splitType: true,
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { paidAt: 'asc' },
      }),
    ]);

    // Waiter-level breakdown
    const waiterMap = new Map<string, { id: string; name: string; paymentOrders: PaymentOrderRow[] }>();
    for (const order of orders) {
      const waiterId = order.createdBy.id;
      const existing = waiterMap.get(waiterId) ?? {
        id: waiterId,
        name: order.createdBy.name,
        paymentOrders: [],
      };
      existing.paymentOrders.push({
        paymentMethod: order.paymentMethod,
        total: order.total,
        mpesaAmount: order.mpesaAmount,
        cashAmount: order.cashAmount,
        cardAmount: order.cardAmount,
        splitType: order.splitType,
      });
      waiterMap.set(waiterId, existing);
    }

    const waiters = Array.from(waiterMap.values())
      .map((w) => ({
        id: w.id,
        name: w.name,
        ordersHandled: w.paymentOrders.length,
        paymentBreakdown: computePaymentBreakdown(w.paymentOrders),
      }))
      .sort((a, b) => b.ordersHandled - a.ordersHandled);

    const allPaymentRows: PaymentOrderRow[] = orders.map((o) => ({
      paymentMethod: o.paymentMethod,
      total: o.total,
      mpesaAmount: o.mpesaAmount,
      cashAmount: o.cashAmount,
      cardAmount: o.cardAmount,
      splitType: o.splitType,
    }));

    const reconciliationOrders = orders.map((o) => ({
      id: o.id,
      dailyNumber: o.dailyNumber,
      time: (o.paidAt ?? new Date()).toISOString(),
      waiterId: o.createdBy.id,
      waiterName: o.createdBy.name,
      total: o.total.toFixed(2),
      paymentMethod: o.paymentMethod ?? 'UNKNOWN',
      mpesaCode: o.mpesaCode ?? null,
      mpesaAmount: o.mpesaAmount?.toFixed(2) ?? null,
      cashAmount: o.cashAmount?.toFixed(2) ?? null,
      cardAmount: o.cardAmount?.toFixed(2) ?? null,
      splitType: o.splitType ?? null,
    }));

    return {
      date: formatDateOnly(date),
      organizationId,
      organizationName: organization?.name ?? 'Unknown Branch',
      summary: computePaymentBreakdown(allPaymentRows),
      waiters,
      orders: reconciliationOrders,
    };
  },

  getStaleOrders: async (
    organizationId: string | null,
    startDate?: Date,
    endDate?: Date,
  ): Promise<import('../types/report.types').StaleOrdersReport> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        orderDate: {
          lt: today,
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
        status: { notIn: [OrderStatus.CLOSED, OrderStatus.CANCELLED] },
        createdBy: { isTestUser: false },
      },
      select: {
        id: true,
        dailyNumber: true,
        status: true,
        orderDate: true,
        total: true,
        createdBy: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            notes: true,
            menuItem: { select: { name: true } },
          },
        },
      },
      orderBy: { orderDate: 'asc' },
    });

    const totalAtRisk = orders.reduce((sum, o) => sum + o.total.toNumber(), 0);

    return {
      organizationId: organizationId ?? null,
      totalOrders: orders.length,
      totalAtRisk: totalAtRisk.toFixed(2),
      orders: orders.map((o) => ({
        id: o.id,
        dailyNumber: o.dailyNumber,
        status: o.status,
        placedAt: o.orderDate.toISOString(),
        waiterId: o.createdBy.id,
        waiterName: o.createdBy.name,
        total: o.total.toFixed(2),
        items: o.items.map((item) => ({
          id: item.id,
          name: item.menuItem.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          subtotal: item.subtotal.toFixed(2),
          notes: item.notes ?? null,
        })),
      })),
    };
  },

  getDiscountUsage: async (
    startDate: Date,
    endDate: Date,
    organizationId?: string,
  ) => {
    const { start, endExclusive } = getOrderDateRangeBounds(startDate, endDate);

    const baseWhere = {
      status: OrderStatus.CLOSED,
      discountId: { not: null as null },
      discountAmount: { not: null as null },
      orderDate: { gte: start, lt: endExclusive },
      createdBy: { isTestUser: false },
      ...(organizationId ? { organizationId } : {}),
    };

    // Per-discount breakdown
    const perDiscountRaw = await prisma.order.groupBy({
      by: ['discountId'],
      where: baseWhere,
      _count: { _all: true },
      _sum: { discountAmount: true },
    });

    // Resolve discount names in one query
    const discountIds = perDiscountRaw
      .map((r) => r.discountId)
      .filter((id): id is string => id !== null);

    const [discounts, perBranchRaw, perWaiterRaw, totals] = await Promise.all([
      prisma.discount.findMany({
        where: { id: { in: discountIds } },
        select: { id: true, name: true, type: true, value: true },
      }),
      // Per-branch breakdown
      prisma.order.groupBy({
        by: ['organizationId'],
        where: baseWhere,
        _count: { _all: true },
        _sum: { discountAmount: true },
      }),
      // Per-waiter breakdown
      prisma.order.groupBy({
        by: ['createdById'],
        where: baseWhere,
        _count: { _all: true },
        _sum: { discountAmount: true },
      }),
      // Aggregate totals
      prisma.order.aggregate({
        where: baseWhere,
        _count: { _all: true },
        _sum: { discountAmount: true },
      }),
    ]);

    // Resolve org and waiter names
    const orgIds = perBranchRaw.map((r) => r.organizationId);
    const waiterIds = perWaiterRaw.map((r) => r.createdById);

    const [orgs, waiters] = await Promise.all([
      prisma.organization.findMany({
        where: { id: { in: orgIds } },
        select: { id: true, name: true },
      }),
      prisma.user.findMany({
        where: { id: { in: waiterIds } },
        select: { id: true, name: true },
      }),
    ]);

    const orgMap = new Map(orgs.map((o) => [o.id, o.name]));
    const waiterMap = new Map(waiters.map((w) => [w.id, w.name]));
    const discountMap = new Map(discounts.map((d) => [d.id, d]));

    return {
      totalDiscounted: toCurrencyString(totals._sum.discountAmount),
      totalOrders: totals._count._all,
      byDiscount: perDiscountRaw.map((r) => {
        const d = discountMap.get(r.discountId ?? '');
        return {
          discountId: r.discountId ?? '',
          name: d?.name ?? 'Unknown',
          type: d?.type ?? 'PERCENTAGE',
          value: d?.value?.toString() ?? '0',
          orderCount: r._count._all,
          totalDiscounted: toCurrencyString(r._sum.discountAmount),
        };
      }),
      byBranch: perBranchRaw.map((r) => ({
        organizationId: r.organizationId,
        name: orgMap.get(r.organizationId) ?? 'Unknown',
        orderCount: r._count._all,
        totalDiscounted: toCurrencyString(r._sum.discountAmount),
      })),
      byWaiter: perWaiterRaw.map((r) => ({
        waiterId: r.createdById,
        name: waiterMap.get(r.createdById) ?? 'Unknown',
        orderCount: r._count._all,
        totalDiscounted: toCurrencyString(r._sum.discountAmount),
      })),
    };
  },
};

