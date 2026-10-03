/** B11 — supplier strips (API_CONTRACT.md §29.3): the pure rules and the two service methods. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { supplierService } from './supplier-service';
import { supplierRepository, supplierStripRepository } from './supplier-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { PROFILE_CHECK_COUNT, invoiceOutstanding, profileDoneCount } from './supplier-summary';
import { SupplierCatalogSummarySchema, SupplierListSummarySchema } from './supplier-validators';
import { ForbiddenError, NotFoundError } from '../../../utils/errors';
import { attendant, buildSupplierRow, hubOrgId, otherOrgId, storeManager, supplierId, waiter } from './supplier-test-fixtures';

vi.mock('./supplier-repository', async () => (await import('./supplier-test-fixtures')).supplierRepositoryMocks());
vi.mock('../purchasing/receiving-repository', () => ({
  referenceCounterRepository: { nextReference: vi.fn() },
  goodsReceiptRepository: { findPackNotOnFileLines: vi.fn() },
}));
vi.mock('../../../repositories/auth-repository', () => ({ authRepository: { findUserById: vi.fn() } }));
vi.mock('../../../sockets/socket-service', () => ({ socketService: { emitChequeMethodAdded: vi.fn() } }));
vi.mock('../../../services/fcm-service', () => ({ fcmService: { sendChequeMethodAddedPush: vi.fn() } }));
vi.mock('../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('./supplier-storage', () => ({ getDocumentStorage: vi.fn() }));
vi.mock('../../../config/database', () => ({ prisma: { $transaction: vi.fn() } }));

const d = (v: string) => new Prisma.Decimal(v);

const complete = {
  name: 'Samrat Supermarket Ltd',
  type: 'REGULAR',
  address: 'Nyeri town',
  kraPin: 'P051234567X',
  contacts: [{ name: 'Dattu', phone: '0722160400', isPrimary: true }],
  payMethodCount: 1,
};

describe('profileDoneCount — the seven checks behind "Profile 4 of 7"', () => {
  it('a complete supplier scores 7 of 7', () => {
    expect(profileDoneCount(complete)).toBe(PROFILE_CHECK_COUNT);
  });

  it('a new supplier with only name, type, phone and address scores 4 of 7', () => {
    // "Add a supplier" collects name, type, phone, address; the contact name defaults to the supplier name.
    expect(
      profileDoneCount({
        name: 'Kagumo Poultry Farm',
        type: 'REGULAR',
        address: 'Kagumo',
        kraPin: null,
        contacts: [{ name: 'Kagumo Poultry Farm', phone: '0711000000', isPrimary: true }],
        payMethodCount: 0,
      }),
    ).toBe(4);
  });

  it('an address of "—" and a blank KRA PIN do not count', () => {
    expect(profileDoneCount({ ...complete, address: '—', kraPin: '  ' })).toBe(5);
  });

  it('no contacts means no phone and no contact person', () => {
    expect(profileDoneCount({ ...complete, contacts: [] })).toBe(5);
  });
});

describe('invoiceOutstanding', () => {
  it('is billed + adjustments − allocations', () => {
    expect(
      invoiceOutstanding({ amountBilled: d('1000'), adjustments: [{ amount: d('-100') }], allocations: [{ amount: d('300') }] }).toString(),
    ).toBe('600');
  });
  it('a reversed payment (negative allocation) puts the money back on the invoice', () => {
    expect(
      invoiceOutstanding({ amountBilled: d('1000'), adjustments: [], allocations: [{ amount: d('1000') }, { amount: d('-1000') }] }).toString(),
    ).toBe('1000');
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId, isHub: true } as never);
  vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplierRow() as never);
});

const stripRow = (over: Record<string, unknown>) => ({
  id: 's',
  name: 'Supplier',
  type: 'REGULAR',
  status: 'ACTIVE',
  address: 'Nyeri',
  kraPin: 'P1',
  contacts: [{ name: 'Person', phone: '0700', isPrimary: true }],
  _count: { payMethods: 1 },
  supplierInvoices: [],
  ...over,
});

describe('supplierService.getListSummary', () => {
  it('counts active, on hold, unfinished profiles and what is owed', async () => {
    vi.mocked(supplierStripRepository.listForStrip).mockResolvedValue([
      stripRow({ id: 'a', status: 'ACTIVE', supplierInvoices: [{ amountBilled: d('1000'), adjustments: [], allocations: [{ amount: d('400') }] }] }),
      stripRow({ id: 'b', status: 'ON_HOLD', kraPin: null }),
      stripRow({
        id: 'c',
        status: 'ACTIVE',
        supplierInvoices: [
          { amountBilled: d('500'), adjustments: [], allocations: [{ amount: d('500') }] }, // paid
          { amountBilled: d('250'), adjustments: [], allocations: [] }, // owed
        ],
      }),
    ] as never);

    const result = await supplierService.getListSummary(storeManager);

    expect(result).toEqual({ active: 2, onHold: 1, profileNotFinished: 1, owedAmount: '850.00', suppliersOwed: 2 });
    expect(() => SupplierListSummarySchema.parse(result)).not.toThrow();
    expect(supplierStripRepository.listForStrip).toHaveBeenCalledWith(hubOrgId);
  });

  it('an overpaid invoice does not reduce what is owed on another', async () => {
    vi.mocked(supplierStripRepository.listForStrip).mockResolvedValue([
      stripRow({
        supplierInvoices: [
          { amountBilled: d('100'), adjustments: [], allocations: [{ amount: d('150') }] },
          { amountBilled: d('300'), adjustments: [], allocations: [] },
        ],
      }),
    ] as never);
    expect((await supplierService.getListSummary(storeManager)).owedAmount).toBe('300.00');
  });

  it('returns zeros, not nulls, for an empty book', async () => {
    vi.mocked(supplierStripRepository.listForStrip).mockResolvedValue([]);
    expect(await supplierService.getListSummary(storeManager)).toEqual({
      active: 0, onHold: 0, profileNotFinished: 0, owedAmount: '0.00', suppliersOwed: 0,
    });
  });

  it('refuses the attendant, a waiter and a non-hub actor', async () => {
    await expect(supplierService.getListSummary(attendant)).rejects.toThrow(ForbiddenError);
    await expect(supplierService.getListSummary(waiter)).rejects.toThrow(ForbiddenError);
    await expect(supplierService.getListSummary({ ...storeManager, siteId: otherOrgId })).rejects.toThrow(ForbiddenError);
    expect(supplierStripRepository.listForStrip).not.toHaveBeenCalled();
  });
});

describe('supplierService.getCatalogSummary', () => {
  it('counts lines, 90-day price alerts and spend, and the last receipt', async () => {
    const lastReceiptAt = new Date('2026-09-28T10:00:00Z');
    vi.mocked(supplierStripRepository.catalogStrip).mockResolvedValue({
      itemsTheySell: 12,
      lastReceiptAt,
      recent: [
        { receiptTotal: d('4800.50'), lines: [{ priceAlertPct: d('6') }, { priceAlertPct: null }] },
        { receiptTotal: d('1200'), lines: [{ priceAlertPct: d('-4') }] },
      ],
    } as never);

    const result = await supplierService.getCatalogSummary(storeManager, supplierId);

    expect(result).toEqual({ itemsTheySell: 12, priceAlerts: 2, lastReceiptAt: lastReceiptAt.toISOString(), spend90Days: '6000.50' });
    expect(() => SupplierCatalogSummarySchema.parse(result)).not.toThrow();
    const since = vi.mocked(supplierStripRepository.catalogStrip).mock.calls[0]![2];
    expect(Date.now() - since.getTime()).toBeGreaterThan(89.9 * 86_400_000);
    expect(Date.now() - since.getTime()).toBeLessThan(90.1 * 86_400_000);
  });

  it('a supplier with no history is all zeros and a null last receipt', async () => {
    vi.mocked(supplierStripRepository.catalogStrip).mockResolvedValue({ itemsTheySell: 0, lastReceiptAt: null, recent: [] });
    expect(await supplierService.getCatalogSummary(storeManager, supplierId)).toEqual({
      itemsTheySell: 0, priceAlerts: 0, lastReceiptAt: null, spend90Days: '0.00',
    });
  });

  it('404s for a supplier outside the hub org and 403s the attendant', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(null);
    await expect(supplierService.getCatalogSummary(storeManager, supplierId)).rejects.toThrow(NotFoundError);
    await expect(supplierService.getCatalogSummary(attendant, supplierId)).rejects.toThrow(ForbiddenError);
  });
});
