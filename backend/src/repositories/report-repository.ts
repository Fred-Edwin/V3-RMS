import { OrderStatus, PrepStation, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { computeActualHours, computeAveragePrepMinutes, computeScheduledHours } from '../utils/report-utils';
import { formatDateOnly } from '../utils/date-only';
import type {
  BranchTrendsReport,
  BranchOverviewReport,
  DailySummaryReport,
  DirectorTrendsReport,
  MyPerformanceReport,
  NamedSeries,
  PrepMyPerformanceReport,
  StaffPerformanceReport,
  StaffPerformanceRow,
  WaiterMyPerformanceReport,
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
    const [organization, aggregate, ordersByTypeRows, paymentRows, topItemRows, prepRows] = await Promise.all([
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

    return {
      date: formatDateOnly(date),
      organizationId,
      organizationName: organization?.name ?? 'Unknown Branch',
      totalRevenue: toCurrencyString(aggregate._sum.total),
      orderCount: aggregate._count._all,
      ordersByType,
      revenueByPaymentMethod,
      topItems,
      averagePrepTimeMinutes: {
        KITCHEN: computeAveragePrepMinutes(kitchenTickets),
        BARISTA: computeAveragePrepMinutes(baristaTickets),
      },
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

    const [waiterRows, prepRows, assignmentRows, clockRows] = await Promise.all([
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
        const [orderAggregate, prepRows] = await Promise.all([
          prisma.order.aggregate({
            where: {
              organizationId: organization.id,
              status: OrderStatus.CLOSED,
              orderDate: {
                gte: start,
                lt: endExclusive,
              },
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
        ]);

        const revenueDecimal = orderAggregate._sum.total ?? new Prisma.Decimal(0);
        const kitchenTickets = prepRows.filter((ticket) => ticket.station === PrepStation.KITCHEN);
        const baristaTickets = prepRows.filter((ticket) => ticket.station === PrepStation.BARISTA);

        return {
          revenueDecimal,
          orderCount: orderAggregate._count._all,
          branch: {
            id: organization.id,
            name: organization.name,
            revenue: revenueDecimal.toFixed(2),
            orderCount: orderAggregate._count._all,
            averagePrepTimeMinutes: {
              KITCHEN: computeAveragePrepMinutes(kitchenTickets),
              BARISTA: computeAveragePrepMinutes(baristaTickets),
            },
          },
        };
      }),
    );

    const totalRevenueDecimal = branchResults.reduce(
      (sum, result) => sum.add(result.revenueDecimal),
      new Prisma.Decimal(0),
    );

    const totalOrders = branchResults.reduce((sum, result) => sum + result.orderCount, 0);

    return {
      period: {
        startDate: formatDateOnly(startDate),
        endDate: formatDateOnly(endDate),
      },
      totalRevenue: totalRevenueDecimal.toFixed(2),
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

    const [orders, categoryRows] = await Promise.all([
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
        },
        select: {
          orderDate: true,
          total: true,
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
        const [activeOrders, tickets, clockedInRecords] = await Promise.all([
          prisma.order.count({
            where: {
              organizationId: organization.id,
              status: { in: ['PENDING', 'IN_PROGRESS', 'READY'] },
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
};

