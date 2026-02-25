import { OrderStatus, PrepStation, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { computeActualHours, computeAveragePrepMinutes, computeScheduledHours } from '../utils/report-utils';
import { formatDateOnly } from '../utils/date-only';
import type {
  BranchOverviewReport,
  DailySummaryReport,
  MyPerformanceReport,
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
};

