import { OrderStatus, OrderType, PaymentMethod, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deliveryZoneRepository } from '../repositories/delivery-zone-repository';
import { staffDiscountAuthService } from './staff-discount-auth-service';
import type { MenuItemWithCategoryRecord } from '../repositories/menu-repository';
import { menuRepository } from '../repositories/menu-repository';
import type { FullOrderPrismaRecord } from '../repositories/order-repository';
import { orderRepository } from '../repositories/order-repository';
import { socketService } from '../sockets/socket-service';
import type { CreateOrderWithTicketsDto } from '../types/order.types';
import { orderService } from './order-service';

vi.mock('../repositories/menu-repository', () => ({
  menuRepository: {
    findItemsWithCategoriesByIds: vi.fn(),
  },
}));

vi.mock('../repositories/delivery-zone-repository', () => ({
  deliveryZoneRepository: {
    findActiveByIdAndOrganization: vi.fn(),
  },
}));

vi.mock('../repositories/order-repository', () => ({
  orderRepository: {
    createWithItemsAndTickets: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    findManySummary: vi.fn(),
    findActive: vi.fn(),
    findActiveSummary: vi.fn(),
    updateItems: vi.fn(),
    recordPayment: vi.fn(),
    cancel: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('./staff-discount-auth-service', () => ({
  staffDiscountAuthService: {
    createAuthRequest: vi.fn(),
  },
}));

vi.mock('../sockets/socket-service', () => ({
  socketService: {
    emitNewOrder: vi.fn(),
    emitOrderClaimed: vi.fn(),
    emitOrderReady: vi.fn(),
    emitOrderAllReady: vi.fn(),
    emitOrderPaid: vi.fn(),
    emitOrderClosed: vi.fn(),
    emitOrderModified: vi.fn(),
    emitOrderCancelled: vi.fn(),
  },
}));

const organizationId = '11111111-1111-4111-8111-111111111111';

const waiterActor = {
  id: '22222222-2222-4222-8222-222222222222',
  role: 'WAITER',
  organizationId,
} as NonNullable<Request['user']>;

const createMenuItem = (
  id: string,
  name: string,
  price: string,
  prepStation: 'KITCHEN' | 'BARISTA',
): MenuItemWithCategoryRecord => {
  return {
    id,
    categoryId: `${prepStation}-category`,
    name,
    description: null,
    price: new Prisma.Decimal(price),
    isActive: true,
    createdAt: new Date('2026-02-24T10:00:00.000Z'),
    updatedAt: new Date('2026-02-24T10:00:00.000Z'),
    deletedAt: null,
    category: {
      id: `${prepStation}-category`,
      name: prepStation === 'KITCHEN' ? 'Meals' : 'Drinks',
      prepStation,
      displayOrder: 1,
      isActive: true,
      createdAt: new Date('2026-02-24T10:00:00.000Z'),
      updatedAt: new Date('2026-02-24T10:00:00.000Z'),
    },
    branchOverrides: [],
  } as unknown as MenuItemWithCategoryRecord;
};

const buildCreatedOrderRecord = (): FullOrderPrismaRecord => {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    organizationId,
    dailyNumber: 1,
    orderDate: new Date('2026-02-24T00:00:00.000Z'),
    type: 'DINE_IN',
    status: 'PENDING',
    tableNumber: '4',
    notes: null,
    subtotal: new Prisma.Decimal('700.00'),
    deliveryFee: new Prisma.Decimal('0.00'),
    total: new Prisma.Decimal('700.00'),
    paymentMethod: null,
    paidAt: null,
    closedAt: null,
    deliveryZoneId: null,
    createdById: waiterActor.id,
    createdAt: new Date('2026-02-24T10:00:00.000Z'),
    updatedAt: new Date('2026-02-24T10:00:00.000Z'),
    createdBy: {
      id: waiterActor.id,
      name: 'Waiter One',
    },
    deliveryZone: null,
    items: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        orderId: '33333333-3333-4333-8333-333333333333',
        menuItemId: '55555555-5555-4555-8555-555555555555',
        quantity: 2,
        unitPrice: new Prisma.Decimal('350.00'),
        subtotal: new Prisma.Decimal('700.00'),
        notes: null,
        menuItem: {
          id: '55555555-5555-4555-8555-555555555555',
          name: 'Latte',
          category: {
            prepStation: 'BARISTA',
          },
        },
      },
    ],
    prepTickets: [
      {
        id: '66666666-6666-4666-8666-666666666666',
        organizationId,
        orderId: '33333333-3333-4333-8333-333333333333',
        station: 'BARISTA',
        status: 'PENDING',
        claimedById: null,
        claimedAt: null,
        readyAt: null,
        items: [{ name: 'Latte', quantity: 2, notes: null }],
        createdAt: new Date('2026-02-24T10:00:00.000Z'),
        updatedAt: new Date('2026-02-24T10:00:00.000Z'),
        claimedBy: null,
      },
    ],
  } as unknown as FullOrderPrismaRecord;
};

const getCreateDtoCall = (): CreateOrderWithTicketsDto => {
  const call = vi.mocked(orderRepository.createWithItemsAndTickets).mock.calls[0];
  if (!call) {
    throw new Error('Expected createWithItemsAndTickets to be called');
  }

  return call[0];
};

const buildDeliveryReadyOrderRecord = (): FullOrderPrismaRecord => {
  const base = buildCreatedOrderRecord();
  return {
    ...base,
    type: OrderType.DELIVERY,
    status: OrderStatus.READY,
    tableNumber: null,
    deliveryFee: new Prisma.Decimal('200.00'),
    total: new Prisma.Decimal('900.00'),
    deliveryZoneId: '99999999-9999-4999-8999-999999999999',
    deliveryZone: {
      id: '99999999-9999-4999-8999-999999999999',
      name: 'Kiganjo',
      fee: new Prisma.Decimal('200.00'),
    },
  } as FullOrderPrismaRecord;
};

describe('orderService.create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orderRepository.createWithItemsAndTickets).mockResolvedValue(buildCreatedOrderRecord());
    vi.mocked(deliveryZoneRepository.findActiveByIdAndOrganization).mockResolvedValue(null);
  });

  it('snapshots menu item prices into order items', async () => {
    vi.mocked(menuRepository.findItemsWithCategoriesByIds).mockResolvedValue([
      createMenuItem('aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Latte', '350.00', 'BARISTA'),
    ]);

    await orderService.create(
      {
        type: 'DINE_IN',
        tableNumber: '4',
        items: [{ menuItemId: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1', quantity: 2, notes: null }],
      },
      waiterActor,
    );

    const createDto = getCreateDtoCall();
    expect(createDto.items).toHaveLength(1);
    expect(createDto.items[0]?.unitPrice.toString()).toBe('350');
    expect(createDto.items[0]?.subtotal.toString()).toBe('700');
    expect(createDto.prepTickets).toHaveLength(1);
    expect(createDto.prepTickets[0]?.station).toBe('BARISTA');
    expect(socketService.emitNewOrder).toHaveBeenCalledWith(organizationId, expect.any(Array));
  });

  it('calculates delivery totals using snapshotted item prices plus delivery fee', async () => {
    vi.mocked(menuRepository.findItemsWithCategoriesByIds).mockResolvedValue([
      createMenuItem('bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Burger', '200.00', 'KITCHEN'),
    ]);
    vi.mocked(deliveryZoneRepository.findActiveByIdAndOrganization).mockResolvedValue({
      fee: new Prisma.Decimal('120.00'),
    } as Awaited<ReturnType<typeof deliveryZoneRepository.findActiveByIdAndOrganization>>);

    await orderService.create(
      {
        type: 'DELIVERY',
        deliveryZoneId: 'ccccccc3-cccc-4ccc-8ccc-ccccccccccc3',
        items: [{ menuItemId: 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbb2', quantity: 3, notes: null }],
      },
      waiterActor,
    );

    const createDto = getCreateDtoCall();
    expect(createDto.subtotal.toString()).toBe('600');
    expect(createDto.deliveryFee.toString()).toBe('120');
    expect(createDto.total.toString()).toBe('720');
    expect(createDto.type).toBe('DELIVERY');
  });

  it('routes prep tickets by station with one ticket per involved station', async () => {
    vi.mocked(menuRepository.findItemsWithCategoriesByIds).mockResolvedValue([
      createMenuItem('ddddddd4-dddd-4ddd-8ddd-ddddddddddd4', 'Burger', '500.00', 'KITCHEN'),
      createMenuItem('eeeeeee5-eeee-4eee-8eee-eeeeeeeeeee5', 'Latte', '300.00', 'BARISTA'),
    ]);

    await orderService.create(
      {
        type: 'TAKE_AWAY',
        items: [
          { menuItemId: 'ddddddd4-dddd-4ddd-8ddd-ddddddddddd4', quantity: 1, notes: null },
          { menuItemId: 'eeeeeee5-eeee-4eee-8eee-eeeeeeeeeee5', quantity: 2, notes: null },
        ],
      },
      waiterActor,
    );

    const createDto = getCreateDtoCall();
    const stations = new Set(createDto.prepTickets.map((ticket) => ticket.station));

    expect(stations).toEqual(new Set(['KITCHEN', 'BARISTA']));
    expect(createDto.prepTickets).toHaveLength(2);

    const kitchenTicket = createDto.prepTickets.find((ticket) => ticket.station === 'KITCHEN');
    const baristaTicket = createDto.prepTickets.find((ticket) => ticket.station === 'BARISTA');

    expect(kitchenTicket?.items.map((item) => item.name)).toEqual(['Burger']);
    expect(baristaTicket?.items.map((item) => item.name)).toEqual(['Latte']);
  });
});


describe('orderService.updateItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const buildEditableOrderRecord = (overrides?: Partial<FullOrderPrismaRecord>): FullOrderPrismaRecord => {
    return {
      ...buildCreatedOrderRecord(),
      status: OrderStatus.IN_PROGRESS,
      items: [
        {
          id: 'item-kitchen-1',
          orderId: '33333333-3333-4333-8333-333333333333',
          menuItemId: 'kitchen-item-1',
          quantity: 1,
          unitPrice: new Prisma.Decimal('500.00'),
          subtotal: new Prisma.Decimal('500.00'),
          notes: null,
          menuItem: {
            id: 'kitchen-item-1',
            name: 'Burger',
            category: {
              prepStation: 'KITCHEN',
            },
          },
        },
        {
          id: 'item-barista-1',
          orderId: '33333333-3333-4333-8333-333333333333',
          menuItemId: 'barista-item-1',
          quantity: 1,
          unitPrice: new Prisma.Decimal('300.00'),
          subtotal: new Prisma.Decimal('300.00'),
          notes: null,
          menuItem: {
            id: 'barista-item-1',
            name: 'Latte',
            category: {
              prepStation: 'BARISTA',
            },
          },
        },
      ],
      prepTickets: [
        {
          id: 'ticket-kitchen-1',
          organizationId,
          orderId: '33333333-3333-4333-8333-333333333333',
          station: 'KITCHEN',
          sequence: 1,
          status: 'IN_PROGRESS',
          claimedById: 'chef-1',
          claimedAt: new Date('2026-02-24T10:05:00.000Z'),
          readyAt: null,
          rejectedById: null,
          rejectedReason: null,
          rejectedAt: null,
          items: [{ menuItemId: 'kitchen-item-1', name: 'Burger', quantity: 1, notes: null }],
          createdAt: new Date('2026-02-24T10:00:00.000Z'),
          updatedAt: new Date('2026-02-24T10:05:00.000Z'),
          claimedBy: { id: 'chef-1', name: 'Chef One' },
        },
        {
          id: 'ticket-barista-1',
          organizationId,
          orderId: '33333333-3333-4333-8333-333333333333',
          station: 'BARISTA',
          sequence: 1,
          status: 'PENDING',
          claimedById: null,
          claimedAt: null,
          readyAt: null,
          rejectedById: null,
          rejectedReason: null,
          rejectedAt: null,
          items: [{ menuItemId: 'barista-item-1', name: 'Latte', quantity: 1, notes: null }],
          createdAt: new Date('2026-02-24T10:00:00.000Z'),
          updatedAt: new Date('2026-02-24T10:00:00.000Z'),
          claimedBy: null,
        },
      ],
      ...overrides,
    } as unknown as FullOrderPrismaRecord;
  };

  it('creates a follow-up ticket when adding items to an in-progress station', async () => {
    const order = buildEditableOrderRecord();

    vi.mocked(orderRepository.findById).mockResolvedValue(order);
    vi.mocked(menuRepository.findItemsWithCategoriesByIds).mockResolvedValue([
      createMenuItem('kitchen-item-1', 'Burger', '500.00', 'KITCHEN'),
      createMenuItem('barista-item-1', 'Latte', '300.00', 'BARISTA'),
      createMenuItem('kitchen-item-2', 'Fries', '200.00', 'KITCHEN'),
    ]);

    const updatedOrder = buildEditableOrderRecord({
      items: [
        ...order.items,
        {
          id: 'item-kitchen-2',
          orderId: order.id,
          menuItemId: 'kitchen-item-2',
          quantity: 1,
          unitPrice: new Prisma.Decimal('200.00'),
          subtotal: new Prisma.Decimal('200.00'),
          notes: null,
          menuItem: {
            id: 'kitchen-item-2',
            name: 'Fries',
            category: { prepStation: 'KITCHEN' },
          },
        },
      ],
      prepTickets: [
        ...order.prepTickets,
        {
          id: 'ticket-kitchen-2',
          organizationId,
          orderId: order.id,
          station: 'KITCHEN',
          sequence: 2,
          status: 'PENDING',
          claimedById: null,
          claimedAt: null,
          readyAt: null,
          rejectedById: null,
          rejectedReason: null,
          rejectedAt: null,
          items: [{ menuItemId: 'kitchen-item-2', name: 'Fries', quantity: 1, notes: null }],
          createdAt: new Date('2026-02-24T10:10:00.000Z'),
          updatedAt: new Date('2026-02-24T10:10:00.000Z'),
          claimedBy: null,
        },
      ],
      subtotal: new Prisma.Decimal('1000.00'),
      total: new Prisma.Decimal('1000.00'),
    });

    vi.mocked(orderRepository.updateItems).mockResolvedValue(updatedOrder);

    await orderService.updateItems(
      order.id,
      {
        items: [
          { menuItemId: 'kitchen-item-1', quantity: 1, notes: null },
          { menuItemId: 'barista-item-1', quantity: 1, notes: null },
          { menuItemId: 'kitchen-item-2', quantity: 1, notes: null },
        ],
      },
      waiterActor,
    );

    const call = vi.mocked(orderRepository.updateItems).mock.calls[0];
    expect(call?.[4].creates).toEqual([
      { station: 'KITCHEN', items: [{ menuItemId: 'kitchen-item-2', name: 'Fries', quantity: 1, notes: null }] },
    ]);

    expect(socketService.emitNewOrder).toHaveBeenCalledWith(organizationId, expect.any(Array));
  });

  it('creates an extra ticket when a started item quantity is increased via stepper', async () => {
    const order = buildEditableOrderRecord();

    vi.mocked(orderRepository.findById).mockResolvedValue(order);
    vi.mocked(menuRepository.findItemsWithCategoriesByIds).mockResolvedValue([
      createMenuItem('kitchen-item-1', 'Burger', '500.00', 'KITCHEN'),
      createMenuItem('barista-item-1', 'Latte', '300.00', 'BARISTA'),
    ]);
    vi.mocked(orderRepository.updateItems).mockResolvedValue(buildEditableOrderRecord());

    await orderService.updateItems(
      order.id,
      {
        items: [
          // Burger bumped from qty 1 → 2 via stepper (single line, higher quantity)
          { menuItemId: 'kitchen-item-1', quantity: 2, notes: null },
          { menuItemId: 'barista-item-1', quantity: 1, notes: null },
        ],
      },
      waiterActor,
    );

    const call = vi.mocked(orderRepository.updateItems).mock.calls[0];
    // One extra ticket created for the additional Burger unit
    expect(call?.[4].creates).toEqual([
      { station: 'KITCHEN', items: [{ menuItemId: 'kitchen-item-1', name: 'Burger', quantity: 1, notes: null }] },
    ]);
  });

  it('rejects decreasing items for a station already in progress', async () => {
    const order = buildEditableOrderRecord();

    vi.mocked(orderRepository.findById).mockResolvedValue(order);
    vi.mocked(menuRepository.findItemsWithCategoriesByIds).mockResolvedValue([
      createMenuItem('barista-item-1', 'Latte', '300.00', 'BARISTA'),
    ]);

    await expect(
      orderService.updateItems(
        order.id,
        {
          items: [{ menuItemId: 'barista-item-1', quantity: 1, notes: null }],
        },
        waiterActor,
      ),
    ).rejects.toThrow('Order cannot be modified. Preparation has already started at one or more stations.');

    expect(orderRepository.updateItems).not.toHaveBeenCalled();
  });
});
describe('orderService.recordPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects non-MPESA payment for delivery orders', async () => {
    vi.mocked(orderRepository.findById).mockResolvedValue(buildDeliveryReadyOrderRecord());

    await expect(
      orderService.recordPayment(
        '33333333-3333-4333-8333-333333333333',
        { paymentMethod: PaymentMethod.CASH },
        waiterActor,
      ),
    ).rejects.toThrow('Delivery orders only accept MPESA payment');

    expect(orderRepository.recordPayment).not.toHaveBeenCalled();
  });

  it('records MPESA payment for delivery orders', async () => {
    const readyOrder = buildDeliveryReadyOrderRecord();
    const closedOrder = {
      ...readyOrder,
      status: OrderStatus.CLOSED,
      paymentMethod: PaymentMethod.MPESA,
      paidAt: new Date('2026-02-24T12:10:00.000Z'),
      closedAt: new Date('2026-02-24T12:10:00.000Z'),
    } as FullOrderPrismaRecord;

    vi.mocked(orderRepository.findById).mockResolvedValue(readyOrder);
    vi.mocked(orderRepository.recordPayment).mockResolvedValue(closedOrder);

    const result = await orderService.recordPayment(
      '33333333-3333-4333-8333-333333333333',
      { paymentMethod: PaymentMethod.MPESA },
      waiterActor,
    );

    expect(orderRepository.recordPayment).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      organizationId,
      {
        paymentMethod: PaymentMethod.MPESA,
        mpesaCode: null,
        mpesaAmount: null,
        cashAmount: null,
        cardAmount: null,
        splitType: null,
        houseAccountId: null,
        corporateAccountId: null,
        corporateEmployeeRef: null,
        customerCreditAccountId: null,
      },
    );
    expect(result.status).toBe('CLOSED');
    expect(result.paymentMethod).toBe('MPESA');
  });

  it('creates staff discount auth request and returns AWAITING_AUTHORIZATION when applyStaffDiscount is true', async () => {
    const readyOrder = buildDeliveryReadyOrderRecord();
    const pendingOrder = {
      ...readyOrder,
      type: 'DINE_IN',
      status: 'AWAITING_AUTHORIZATION',
    } as FullOrderPrismaRecord;

    vi.mocked(orderRepository.findById)
      .mockResolvedValueOnce({ ...readyOrder, type: 'DINE_IN', status: 'READY' } as FullOrderPrismaRecord)
      .mockResolvedValueOnce(pendingOrder);
    vi.mocked(staffDiscountAuthService.createAuthRequest).mockResolvedValue({} as ReturnType<typeof staffDiscountAuthService.createAuthRequest> extends Promise<infer T> ? T : never);

    const result = await orderService.recordPayment(
      '33333333-3333-4333-8333-333333333333',
      { paymentMethod: PaymentMethod.CASH, applyStaffDiscount: true },
      waiterActor,
    );

    expect(staffDiscountAuthService.createAuthRequest).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      organizationId,
      waiterActor,
    );
    expect(orderRepository.recordPayment).not.toHaveBeenCalled();
    expect(result.status).toBe('AWAITING_AUTHORIZATION');
  });
});
