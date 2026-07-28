import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/database';
import { supplierInvoiceRepository } from '../repositories/supplier-invoice-repository';
import { supplierRepository } from '../repositories/supplier-repository';
import { supplierInvoiceService } from './supplier-invoice-service';
import { ValidationError } from '../utils/errors';

vi.mock('../config/database', () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock('../repositories/supplier-invoice-repository', () => ({
  supplierInvoiceRepository: {
    findAllByOrganization: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    updateAmountPaidAndStatus: vi.fn(),
    createPayment: vi.fn(),
  },
}));

vi.mock('../repositories/supplier-repository', () => ({
  supplierRepository: { findById: vi.fn() },
}));

vi.mock('../repositories/purchase-order-repository', () => ({
  purchaseOrderRepository: { findById: vi.fn() },
}));

const organizationId = '11111111-1111-4111-8111-111111111111';
const managerId = '22222222-2222-4222-8222-222222222222';
const supplierId = '33333333-3333-4333-8333-333333333333';
const invoiceId = '44444444-4444-4444-8444-444444444444';

const d = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const actor = { id: managerId, role: 'STORE_MANAGER' as const, organizationId };

const buildInvoice = (overrides: Record<string, unknown> = {}) => ({
  id: invoiceId,
  organizationId,
  supplierId,
  purchaseOrderId: null,
  referenceNumber: 'INV-001',
  amount: d(5000),
  amountPaid: d(0),
  status: 'UNPAID' as const,
  invoiceDate: new Date(),
  createdById: managerId,
  createdAt: new Date(),
  updatedAt: new Date(),
  supplier: { id: supplierId, name: 'Metro Supermarket' },
  payments: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((fn) =>
    (fn as (tx: unknown) => Promise<unknown>)(prisma),
  );
});

describe('supplierInvoiceService.recordPayment status derivation', () => {
  it('a partial payment moves UNPAID -> PARTIALLY_PAID', async () => {
    vi.mocked(supplierInvoiceRepository.findById)
      .mockResolvedValueOnce(buildInvoice() as never)
      .mockResolvedValueOnce(buildInvoice({ status: 'PARTIALLY_PAID', amountPaid: d(2000) }) as never);

    const result = await supplierInvoiceService.recordPayment(actor, invoiceId, {
      amount: '2000',
      method: 'MPESA',
      paidAt: new Date().toISOString(),
    });

    expect(supplierInvoiceRepository.updateAmountPaidAndStatus).toHaveBeenCalledWith(
      invoiceId,
      organizationId,
      { amountPaid: d(2000), status: 'PARTIALLY_PAID' },
      prisma,
    );
    expect(result.status).toBe('PARTIALLY_PAID');
  });

  it('a payment covering the full amount moves to PAID', async () => {
    vi.mocked(supplierInvoiceRepository.findById)
      .mockResolvedValueOnce(buildInvoice({ amountPaid: d(2000), status: 'PARTIALLY_PAID' }) as never)
      .mockResolvedValueOnce(buildInvoice({ amountPaid: d(5000), status: 'PAID' }) as never);

    const result = await supplierInvoiceService.recordPayment(actor, invoiceId, {
      amount: '3000',
      method: 'CASH',
      paidAt: new Date().toISOString(),
    });

    expect(supplierInvoiceRepository.updateAmountPaidAndStatus).toHaveBeenCalledWith(
      invoiceId,
      organizationId,
      { amountPaid: d(5000), status: 'PAID' },
      prisma,
    );
    expect(result.status).toBe('PAID');
  });

  it('rejects a payment against an already-PAID invoice', async () => {
    vi.mocked(supplierInvoiceRepository.findById).mockResolvedValue(
      buildInvoice({ status: 'PAID', amountPaid: d(5000) }) as never,
    );

    await expect(
      supplierInvoiceService.recordPayment(actor, invoiceId, {
        amount: '100',
        method: 'CASH',
        paidAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(ValidationError);
    expect(supplierInvoiceRepository.createPayment).not.toHaveBeenCalled();
  });

  it('rejects a zero-or-negative payment amount', async () => {
    vi.mocked(supplierInvoiceRepository.findById).mockResolvedValue(buildInvoice() as never);

    await expect(
      supplierInvoiceService.recordPayment(actor, invoiceId, {
        amount: '0',
        method: 'CASH',
        paidAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('supplierInvoiceService.create', () => {
  it('validates the supplier exists before creating the invoice', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(null);

    await expect(
      supplierInvoiceService.create(actor, {
        supplierId,
        referenceNumber: 'INV-001',
        amount: '5000',
        invoiceDate: new Date().toISOString(),
      }),
    ).rejects.toThrow('supplierId does not reference a known supplier');
  });
});
