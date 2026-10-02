import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { supplierService } from './supplier-service';
import {
  supplierAuditRepository,
  supplierContactRepository,
  supplierItemRepository,
  supplierPayMethodRepository,
  supplierRepository,
  supplierItemLookupRepository,
} from './supplier-repository';
import * as supplierRepositoryModule from './supplier-repository';
import { referenceCounterRepository } from './receiving-repository';
import { branchRepository } from '../../repositories/branch-repository';
import { prisma } from '../../config/database';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/errors';
import {
  accountant,
  attendant,
  buildContact,
  buildPayMethod,
  buildSupplierRow,
  contactId,
  contactId2,
  director,
  hubOrgId,
  itemId,
  methodId,
  methodId2,
  otherOrgId,
  storeManager,
  supplierId,
  waiter,
} from './supplier-test-fixtures';

vi.mock('./supplier-repository', async () => (await import('./supplier-test-fixtures')).supplierRepositoryMocks());
vi.mock('./receiving-repository', () => ({ referenceCounterRepository: { nextReference: vi.fn() } }));
vi.mock('../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('./supplier-storage', () => ({ getDocumentStorage: vi.fn() }));

const tx = { marker: 'tx' };
vi.mock('../../config/database', () => ({
  prisma: { $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)) },
}));

const account = '0170123456789';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchRepository.findHub).mockResolvedValue({ id: hubOrgId, isHub: true } as never);
  vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplierRow() as never);
  vi.mocked(supplierRepository.findDetailById).mockResolvedValue(buildSupplierRow() as never);
  vi.mocked(supplierRepository.findLiveWithPhones).mockResolvedValue([]);
  vi.mocked(supplierRepository.create).mockResolvedValue({ id: supplierId });
});

const validCreate = { name: 'Kagumo Poultry', address: 'Kagumo', type: 'REGULAR' as const, vatRegistered: false, defaultPaymentTerms: 'INVOICE_TO_FOLLOW' as const };

describe('supplierService — code generation', () => {
  it('numbers inside the create transaction with prefix SUPPLIER, pad 4', async () => {
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('SUPPLIER-0008');
    await supplierService.createSupplier(storeManager, validCreate);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(referenceCounterRepository.nextReference).toHaveBeenCalledWith(tx, hubOrgId, 'SUPPLIER', 4);
    expect(supplierRepository.create).toHaveBeenCalledWith(
      hubOrgId,
      expect.objectContaining({ code: 'SUPPLIER-0008', status: 'ACTIVE', createdById: 'sm1' }),
      tx,
    );
  });

  it('concurrent creates each take their own number and never reuse one', async () => {
    let last = 0;
    vi.mocked(referenceCounterRepository.nextReference).mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, Math.random() * 5));
      last += 1;
      return `SUPPLIER-${String(last).padStart(4, '0')}`;
    });
    await Promise.all(
      ['A', 'B', 'C', 'D', 'E'].map((n) => supplierService.createSupplier(storeManager, { ...validCreate, name: `Supplier ${n}` })),
    );
    const codes = vi.mocked(supplierRepository.create).mock.calls.map((c) => c[1].code);
    expect(new Set(codes).size).toBe(5);
  });

  it('a rolled-back create surfaces the error and does not create contacts', async () => {
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('SUPPLIER-0009');
    vi.mocked(supplierRepository.create).mockRejectedValue(new Error('boom'));
    await expect(supplierService.createSupplier(storeManager, { ...validCreate, contactName: 'X' })).rejects.toThrow('boom');
    expect(supplierContactRepository.create).not.toHaveBeenCalled();
  });

  it('never lets the caller set the code', async () => {
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('SUPPLIER-0010');
    await supplierService.createSupplier(storeManager, { ...validCreate, code: 'SUPPLIER-9999' } as never);
    expect(vi.mocked(supplierRepository.create).mock.calls[0]![1].code).toBe('SUPPLIER-0010');
  });
});

describe('supplierService — duplicate detection', () => {
  const existing = { id: 'x', code: 'SUPPLIER-0002', name: 'Kagumo Poultry Farm', contacts: [{ phone: '0722 410 552' }] };

  it('409s on the same normalized name and phone (formatting differences ignored)', async () => {
    vi.mocked(supplierRepository.findLiveWithPhones).mockResolvedValue([existing]);
    await expect(
      supplierService.createSupplier(storeManager, { ...validCreate, name: 'KAGUMO poultry  farm.', phone: '+254722410552' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE_SUPPLIER' });
    expect(supplierRepository.create).not.toHaveBeenCalled();
  });

  it('proceeds when confirmDuplicate is set', async () => {
    vi.mocked(supplierRepository.findLiveWithPhones).mockResolvedValue([existing]);
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('SUPPLIER-0011');
    await supplierService.createSupplier(storeManager, {
      ...validCreate,
      name: 'Kagumo Poultry Farm',
      phone: '0722410552',
      confirmDuplicate: true,
    });
    expect(supplierRepository.create).toHaveBeenCalled();
  });

  it('allows the same name with a different phone', async () => {
    vi.mocked(supplierRepository.findLiveWithPhones).mockResolvedValue([existing]);
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('SUPPLIER-0012');
    await supplierService.createSupplier(storeManager, { ...validCreate, name: 'Kagumo Poultry Farm', phone: '0799000111' });
    expect(supplierRepository.create).toHaveBeenCalled();
  });

  it('applies to quick-add too', async () => {
    vi.mocked(supplierRepository.findLiveWithPhones).mockResolvedValue([existing]);
    await expect(
      supplierService.quickAddSupplier(attendant, { name: 'Kagumo Poultry Farm', phone: '0722410552' }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_SUPPLIER' });
  });
});

describe('supplierService — quick add', () => {
  it('creates a ONE_OFF supplier with a primary contact and returns the attendant shape to attendants', async () => {
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('SUPPLIER-0013');
    vi.mocked(supplierRepository.findById).mockResolvedValue(
      buildSupplierRow({ type: 'ONE_OFF', kraPin: null, contacts: [buildContact({ phone: '0700000001' })] }) as never,
    );

    const result = await supplierService.quickAddSupplier(attendant, { name: 'Roadside Mangoes', phone: '0700000001' });

    expect(supplierRepository.create).toHaveBeenCalledWith(
      hubOrgId,
      expect.objectContaining({ type: 'ONE_OFF', address: '—' }),
      tx,
    );
    expect(supplierContactRepository.create).toHaveBeenCalledWith(
      hubOrgId,
      supplierId,
      expect.objectContaining({ name: 'Roadside Mangoes', phone: '0700000001', isPrimary: true }),
      tx,
    );
    expect(Object.keys(result).sort()).toEqual(['code', 'id', 'name', 'primaryPhone', 'type']);
  });
});

describe('supplierService — primary contact rule', () => {
  it('the first contact becomes primary', async () => {
    vi.mocked(supplierContactRepository.count).mockResolvedValue(0);
    vi.mocked(supplierContactRepository.create).mockResolvedValue(buildContact() as never);
    await supplierService.createContact(storeManager, supplierId, { name: 'Dattu', role: 'OTHER' });
    expect(supplierContactRepository.create).toHaveBeenCalledWith(
      hubOrgId, supplierId, expect.objectContaining({ isPrimary: true }), tx,
    );
  });

  it('a later contact is not primary unless asked; asking demotes the old one first', async () => {
    vi.mocked(supplierContactRepository.count).mockResolvedValue(1);
    vi.mocked(supplierContactRepository.create).mockResolvedValue(buildContact({ id: contactId2, isPrimary: false }) as never);
    await supplierService.createContact(storeManager, supplierId, { name: 'Jane', role: 'ACCOUNTS' });
    expect(supplierContactRepository.unsetPrimary).not.toHaveBeenCalled();
    expect(vi.mocked(supplierContactRepository.create).mock.calls[0]![2].isPrimary).toBe(false);

    await supplierService.createContact(storeManager, supplierId, { name: 'Jane', role: 'ACCOUNTS', isPrimary: true });
    expect(supplierContactRepository.unsetPrimary).toHaveBeenCalledWith(supplierId, hubOrgId, tx);
    expect(vi.mocked(supplierContactRepository.create).mock.calls[1]![2].isPrimary).toBe(true);
  });

  it('promoting another contact demotes the current primary', async () => {
    vi.mocked(supplierContactRepository.findById)
      .mockResolvedValueOnce(buildContact({ id: contactId2, isPrimary: false }) as never)
      .mockResolvedValueOnce(buildContact({ id: contactId2, isPrimary: true }) as never);
    await supplierService.updateContact(storeManager, supplierId, contactId2, { isPrimary: true });
    expect(supplierContactRepository.unsetPrimary).toHaveBeenCalled();
  });

  it('refuses to un-primary or delete the primary while others exist', async () => {
    vi.mocked(supplierContactRepository.findById).mockResolvedValue(buildContact() as never);
    await expect(
      supplierService.updateContact(storeManager, supplierId, contactId, { isPrimary: false }),
    ).rejects.toMatchObject({ code: 'PRIMARY_CONTACT_REQUIRED' });

    vi.mocked(supplierContactRepository.count).mockResolvedValue(2);
    await expect(supplierService.deleteContact(storeManager, supplierId, contactId)).rejects.toThrow(ConflictError);
    expect(supplierContactRepository.delete).not.toHaveBeenCalled();
  });

  it('allows deleting the only contact', async () => {
    vi.mocked(supplierContactRepository.findById).mockResolvedValue(buildContact() as never);
    vi.mocked(supplierContactRepository.count).mockResolvedValue(1);
    await supplierService.deleteContact(storeManager, supplierId, contactId);
    expect(supplierContactRepository.delete).toHaveBeenCalledWith(contactId, supplierId, hubOrgId);
  });

  it('404s on a contact that is not this supplier\'s', async () => {
    vi.mocked(supplierContactRepository.findById).mockResolvedValue(null);
    await expect(supplierService.updateContact(storeManager, supplierId, contactId, { name: 'x' })).rejects.toThrow(NotFoundError);
  });
});

describe('supplierService — legacy write aliases', () => {
  it('PATCH contactName/phone/email edits the primary contact; location edits the address', async () => {
    await supplierService.updateSupplier(storeManager, supplierId, { location: 'Karatina', phone: '0711000000' });
    expect(supplierRepository.update).toHaveBeenCalledWith(
      supplierId, hubOrgId, expect.objectContaining({ address: 'Karatina', updatedById: 'sm1' }), tx,
    );
    expect(supplierContactRepository.update).toHaveBeenCalledWith(
      contactId, supplierId, hubOrgId, { phone: '0711000000' }, tx,
    );
  });
});

describe('supplierService — payment methods', () => {
  const bank = { type: 'BANK_TRANSFER' as const, bankName: 'Equity', accountName: 'Samrat', accountNumber: account };

  it('the first method becomes the default and is audited with a masked account number', async () => {
    vi.mocked(supplierPayMethodRepository.count).mockResolvedValue(0);
    vi.mocked(supplierPayMethodRepository.create).mockResolvedValue(buildPayMethod() as never);

    const result = await supplierService.createPayMethod(storeManager, supplierId, bank);

    expect(vi.mocked(supplierPayMethodRepository.create).mock.calls[0]![3].isDefault).toBe(true);
    expect(supplierAuditRepository.create).toHaveBeenCalledWith(
      hubOrgId, supplierId, 'sm1', 'PAY_METHOD_CREATED', methodId, null,
      expect.objectContaining({ accountNumber: '••••6789' }), tx,
    );
    expect(JSON.stringify(vi.mocked(supplierAuditRepository.create).mock.calls)).not.toContain(account);
    expect(JSON.stringify(result)).not.toContain(account);
    expect(result).toMatchObject({ accountNumberMasked: '••••6789' });
  });

  it('a new default demotes the old one and logs the default change', async () => {
    vi.mocked(supplierPayMethodRepository.count).mockResolvedValue(1);
    vi.mocked(supplierPayMethodRepository.findDefault).mockResolvedValue(buildPayMethod() as never);
    vi.mocked(supplierPayMethodRepository.create).mockResolvedValue(buildPayMethod({ id: methodId2, type: 'CASH' }) as never);

    await supplierService.createPayMethod(accountant, supplierId, { type: 'CASH', isDefault: true });

    expect(supplierPayMethodRepository.unsetDefault).toHaveBeenCalledWith(supplierId, hubOrgId, tx);
    const actions = vi.mocked(supplierAuditRepository.create).mock.calls.map((c) => c[3]);
    expect(actions).toEqual(['PAY_METHOD_CREATED', 'PAY_METHOD_DEFAULT_CHANGED']);
  });

  it('validates the fields required by each type', async () => {
    await expect(supplierService.createPayMethod(storeManager, supplierId, { type: 'MPESA_TILL' } as never)).rejects.toThrow();
    await expect(
      supplierService.createPayMethod(storeManager, supplierId, { type: 'BANK_TRANSFER', bankName: 'Equity' } as never),
    ).rejects.toThrow();
  });

  it('drops fields that do not belong to the type', async () => {
    vi.mocked(supplierPayMethodRepository.count).mockResolvedValue(1);
    vi.mocked(supplierPayMethodRepository.create).mockResolvedValue(buildPayMethod({ type: 'MPESA_TILL', tillNumber: '123456' }) as never);
    await supplierService.createPayMethod(storeManager, supplierId, { type: 'MPESA_TILL', tillNumber: '123456', accountNumber: account } as never);
    expect(vi.mocked(supplierPayMethodRepository.create).mock.calls[0]![3]).toMatchObject({ tillNumber: '123456', accountNumber: null });
  });

  it('refuses to unset or delete the default while other methods exist', async () => {
    vi.mocked(supplierPayMethodRepository.findById).mockResolvedValue(buildPayMethod() as never);
    await expect(
      supplierService.updatePayMethod(storeManager, supplierId, methodId, { isDefault: false }),
    ).rejects.toMatchObject({ code: 'DEFAULT_METHOD_REQUIRED' });

    vi.mocked(supplierPayMethodRepository.count).mockResolvedValue(2);
    await expect(supplierService.deletePayMethod(storeManager, supplierId, methodId)).rejects.toThrow(ConflictError);
    expect(supplierPayMethodRepository.delete).not.toHaveBeenCalled();
  });

  it('update audits before/after with both account numbers masked', async () => {
    const before = buildPayMethod();
    const after = buildPayMethod({ accountNumber: '9990000001111' });
    vi.mocked(supplierPayMethodRepository.findById).mockResolvedValueOnce(before as never).mockResolvedValueOnce(after as never);

    await supplierService.updatePayMethod(accountant, supplierId, methodId, { accountNumber: '9990000001111' });

    const [, , , action, , beforeJson, afterJson] = vi.mocked(supplierAuditRepository.create).mock.calls[0]!;
    expect(action).toBe('PAY_METHOD_UPDATED');
    expect(beforeJson).toMatchObject({ accountNumber: '••••6789' });
    expect(afterJson).toMatchObject({ accountNumber: '••••1111' });
    const logged = JSON.stringify(vi.mocked(supplierAuditRepository.create).mock.calls);
    expect(logged).not.toContain(account);
    expect(logged).not.toContain('9990000001111');
  });

  it('delete audits the removed method (masked)', async () => {
    vi.mocked(supplierPayMethodRepository.findById).mockResolvedValue(buildPayMethod() as never);
    vi.mocked(supplierPayMethodRepository.count).mockResolvedValue(1);
    await supplierService.deletePayMethod(storeManager, supplierId, methodId);
    expect(vi.mocked(supplierAuditRepository.create).mock.calls[0]![3]).toBe('PAY_METHOD_DELETED');
    expect(JSON.stringify(vi.mocked(supplierAuditRepository.create).mock.calls)).not.toContain(account);
  });

  it('only the single-method GET returns the full account number', async () => {
    vi.mocked(supplierPayMethodRepository.list).mockResolvedValue([buildPayMethod()] as never);
    vi.mocked(supplierPayMethodRepository.findById).mockResolvedValue(buildPayMethod() as never);
    expect(JSON.stringify(await supplierService.listPayMethods(director, supplierId))).not.toContain(account);
    expect(JSON.stringify(await supplierService.getSupplierById(director, supplierId))).not.toContain(account);
    expect(await supplierService.getPayMethod(director, supplierId, methodId)).toMatchObject({ accountNumber: account });
  });
});

describe('supplierService — status', () => {
  it('moves ACTIVE to ON_HOLD and audits it', async () => {
    await supplierService.updateStatus(storeManager, supplierId, { status: 'ON_HOLD', reason: 'Quality' });
    expect(supplierRepository.setStatus).toHaveBeenCalledWith(supplierId, hubOrgId, 'ON_HOLD', 'sm1', tx);
    expect(supplierAuditRepository.create).toHaveBeenCalledWith(
      hubOrgId, supplierId, 'sm1', 'STATUS_CHANGED', supplierId,
      { status: 'ACTIVE' }, { status: 'ON_HOLD', reason: 'Quality' }, tx,
    );
    expect(supplierRepository.clearPreferred).not.toHaveBeenCalled();
  });

  it('refuses a no-op transition', async () => {
    await expect(supplierService.updateStatus(storeManager, supplierId, { status: 'ACTIVE' })).rejects.toMatchObject({
      code: 'STATUS_UNCHANGED',
    });
  });

  it('blocks archiving while an invoice is unpaid', async () => {
    vi.mocked(supplierRepository.countOpenInvoices).mockResolvedValue(2);
    await expect(supplierService.updateStatus(storeManager, supplierId, { status: 'ARCHIVED' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'SUPPLIER_HAS_OPEN_INVOICES',
    });
    expect(supplierRepository.setStatus).not.toHaveBeenCalled();
  });

  it('archives with no open invoices, clearing preferred marks; restore goes back to ACTIVE', async () => {
    vi.mocked(supplierRepository.countOpenInvoices).mockResolvedValue(0);
    await supplierService.updateStatus(storeManager, supplierId, { status: 'ARCHIVED' });
    expect(supplierRepository.clearPreferred).toHaveBeenCalledWith(supplierId, hubOrgId, tx);

    vi.mocked(supplierRepository.findById).mockResolvedValue(buildSupplierRow({ status: 'ARCHIVED', deletedAt: new Date() }) as never);
    await supplierService.restoreSupplier(storeManager, supplierId);
    expect(supplierRepository.setStatus).toHaveBeenLastCalledWith(supplierId, hubOrgId, 'ACTIVE', 'sm1', tx);
  });

  it('legacy retire is the archive path (open-invoice block applies)', async () => {
    vi.mocked(supplierRepository.countOpenInvoices).mockResolvedValue(1);
    await expect(supplierService.retireSupplier(storeManager, supplierId)).rejects.toMatchObject({ code: 'SUPPLIER_HAS_OPEN_INVOICES' });
  });
});

describe('supplierService — catalog and preferred sync', () => {
  beforeEach(() => {
    vi.mocked(supplierItemLookupRepository.findLiveItem).mockResolvedValue({ id: itemId, name: 'Milk', buyUnit: 'crate' } as never);
    vi.mocked(supplierItemRepository.upsert).mockResolvedValue({} as never);
    vi.mocked(supplierItemRepository.list).mockResolvedValue([
      {
        inventoryItemId: itemId, supplierItemName: null, supplierItemCode: null, buyUnit: 'crate', packSize: null,
        lastPrice: new Prisma.Decimal('2025'), lastPriceAt: new Date(), isPreferred: true,
        inventoryItem: { id: itemId, name: 'Milk', buyUnit: 'crate' },
      },
    ] as never);
  });

  it('marking preferred makes it the single preferred supplier for the item', async () => {
    await supplierService.putItem(storeManager, supplierId, itemId, { isPreferred: true });
    expect(supplierItemRepository.applyPreferred).toHaveBeenCalledWith(hubOrgId, itemId, supplierId, tx);
  });

  it('un-marking clears only this supplier\'s preferred mark', async () => {
    await supplierService.putItem(storeManager, supplierId, itemId, { isPreferred: false });
    expect(supplierItemRepository.clearPreferredIfSupplier).toHaveBeenCalledWith(hubOrgId, itemId, supplierId, tx);
    expect(supplierItemRepository.applyPreferred).not.toHaveBeenCalled();
  });

  it('leaves the preferred flag alone when not sent', async () => {
    await supplierService.putItem(storeManager, supplierId, itemId, { supplierItemName: 'Fresh milk' });
    expect(supplierItemRepository.applyPreferred).not.toHaveBeenCalled();
    expect(supplierItemRepository.clearPreferredIfSupplier).not.toHaveBeenCalled();
  });

  it('404s on an unknown or retired catalog item', async () => {
    vi.mocked(supplierItemLookupRepository.findLiveItem).mockResolvedValue(null);
    await expect(supplierService.putItem(storeManager, supplierId, itemId, {})).rejects.toThrow(NotFoundError);
  });

  it('deleting a row clears its preferred mark', async () => {
    vi.mocked(supplierItemRepository.find).mockResolvedValue({} as never);
    await supplierService.deleteItem(storeManager, supplierId, itemId);
    expect(supplierItemRepository.clearPreferredIfSupplier).toHaveBeenCalled();
    expect(supplierItemRepository.delete).toHaveBeenCalledWith(supplierId, itemId, hubOrgId, tx);
  });
});

describe('supplierService — roles and scope', () => {
  it('attendants get the stripped list, limited to ACTIVE suppliers', async () => {
    vi.mocked(supplierRepository.findAllByOrganization).mockResolvedValue({ suppliers: [buildSupplierRow()], total: 1 } as never);
    const { data } = await supplierService.listSuppliers(attendant, { page: 1, perPage: 20, includeRetired: true, status: 'ARCHIVED' });
    expect(vi.mocked(supplierRepository.findAllByOrganization).mock.calls[0]![1].status).toBe('ACTIVE');
    expect(Object.keys(data[0]!).sort()).toEqual(['code', 'id', 'name', 'primaryPhone', 'type']);
  });

  it.each([
    ['getSupplierById', () => supplierService.getSupplierById(attendant, supplierId)],
    ['listContacts', () => supplierService.listContacts(attendant, supplierId)],
    ['listPayMethods', () => supplierService.listPayMethods(attendant, supplierId)],
    ['getPayMethod', () => supplierService.getPayMethod(attendant, supplierId, methodId)],
    ['listItems', () => supplierService.listItems(attendant, supplierId)],
    ['listDocuments', () => supplierService.listDocuments(attendant, supplierId, 10)],
    ['getSummary', () => supplierService.getSummary(attendant, supplierId)],
    ['updateSupplier', () => supplierService.updateSupplier(attendant, supplierId, { name: 'x' })],
    ['createSupplier', () => supplierService.createSupplier(attendant, validCreate)],
    ['updateStatus', () => supplierService.updateStatus(attendant, supplierId, { status: 'ON_HOLD' })],
  ])('rejects the attendant on %s', async (_name, call) => {
    await expect(call()).rejects.toThrow(ForbiddenError);
  });

  it('only Store Manager and Accountant may write payment methods; Director and others may not', async () => {
    for (const who of [director, waiter, attendant]) {
      await expect(supplierService.createPayMethod(who, supplierId, { type: 'CASH' })).rejects.toThrow(ForbiddenError);
      await expect(supplierService.deletePayMethod(who, supplierId, methodId)).rejects.toThrow(ForbiddenError);
    }
  });

  it('non-hub actors are refused', async () => {
    await expect(
      supplierService.getSupplierById({ ...storeManager, organizationId: otherOrgId }, supplierId),
    ).rejects.toThrow(ForbiddenError);
  });

  it('a supplier outside the org is a 404 for every sub-resource', async () => {
    vi.mocked(supplierRepository.findById).mockResolvedValue(null);
    vi.mocked(supplierRepository.findDetailById).mockResolvedValue(null);
    await expect(supplierService.getSupplierById(storeManager, supplierId)).rejects.toThrow(NotFoundError);
    await expect(supplierService.listContacts(storeManager, supplierId)).rejects.toThrow(NotFoundError);
    await expect(supplierService.listPayMethods(storeManager, supplierId)).rejects.toThrow(NotFoundError);
    await expect(supplierService.createPayMethod(storeManager, supplierId, { type: 'CASH' })).rejects.toThrow(NotFoundError);
    await expect(supplierService.listItems(storeManager, supplierId)).rejects.toThrow(NotFoundError);
    await expect(supplierService.getSummary(storeManager, supplierId)).rejects.toThrow(NotFoundError);
    await expect(supplierService.updateStatus(storeManager, supplierId, { status: 'ON_HOLD' })).rejects.toThrow(NotFoundError);
    expect(supplierContactRepository.list).not.toHaveBeenCalled();
    expect(supplierPayMethodRepository.list).not.toHaveBeenCalled();
  });

  it('every repository call is scoped by the hub organizationId', async () => {
    vi.mocked(supplierRepository.findAllByOrganization).mockResolvedValue({ suppliers: [buildSupplierRow()], total: 1 } as never);
    vi.mocked(supplierContactRepository.list).mockResolvedValue([buildContact()] as never);
    vi.mocked(supplierPayMethodRepository.list).mockResolvedValue([buildPayMethod()] as never);
    vi.mocked(supplierPayMethodRepository.findById).mockResolvedValue(buildPayMethod() as never);
    vi.mocked(supplierItemRepository.list).mockResolvedValue([]);
    vi.mocked(supplierContactRepository.findById).mockResolvedValue(buildContact() as never);
    vi.mocked(supplierContactRepository.count).mockResolvedValue(1);
    vi.mocked(supplierRepository.countOpenInvoices).mockResolvedValue(0);

    await supplierService.listSuppliers(storeManager, { page: 1, perPage: 20, includeRetired: false });
    await supplierService.getSupplierById(storeManager, supplierId);
    await supplierService.listContacts(storeManager, supplierId);
    await supplierService.updateContact(storeManager, supplierId, contactId, { name: 'x' });
    await supplierService.deleteContact(storeManager, supplierId, contactId);
    await supplierService.listPayMethods(storeManager, supplierId);
    await supplierService.getPayMethod(storeManager, supplierId, methodId);
    await supplierService.deletePayMethod(storeManager, supplierId, methodId);
    await supplierService.listItems(storeManager, supplierId);
    await supplierService.updateStatus(storeManager, supplierId, { status: 'ON_HOLD' });

    const repos = supplierRepositoryModule as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
    let checked = 0;
    for (const repo of Object.values(repos)) {
      for (const fn of Object.values(repo)) {
        for (const call of fn.mock.calls) {
          checked += 1;
          expect(call, JSON.stringify(call)).toContain(hubOrgId);
        }
      }
    }
    expect(checked).toBeGreaterThan(15);
  });
});

describe('supplierService — summary', () => {
  it('aggregates spend, alerts, short deliveries and average days to pay', async () => {
    const { supplierHistoryRepository } = supplierRepositoryModule;
    vi.mocked(supplierHistoryRepository.summaryReceipts).mockResolvedValue([
      {
        id: 'r1', signedAt: new Date('2026-09-01'), receiptTotal: new Prisma.Decimal('1000'),
        lines: [{ inventoryItemId: itemId, quantityBuyUnit: new Prisma.Decimal('8'), priceAlertPct: new Prisma.Decimal('20') }],
        expectedDelivery: { lines: [{ inventoryItemId: itemId, quantity: new Prisma.Decimal('10') }] },
      },
      {
        id: 'r2', signedAt: new Date('2026-09-10'), receiptTotal: new Prisma.Decimal('500.5'),
        lines: [{ inventoryItemId: itemId, quantityBuyUnit: new Prisma.Decimal('10'), priceAlertPct: null }],
        expectedDelivery: { lines: [{ inventoryItemId: itemId, quantity: new Prisma.Decimal('10') }] },
      },
    ] as never);
    vi.mocked(supplierHistoryRepository.summaryInvoices).mockResolvedValue([
      {
        invoiceDate: new Date('2026-09-01'), amountBilled: new Prisma.Decimal('1000'), adjustments: [],
        allocations: [{ amount: new Prisma.Decimal('1000'), supplierPayment: { paidAt: new Date('2026-09-11'), reversalOfId: null } }],
      },
      { invoiceDate: new Date('2026-09-05'), amountBilled: new Prisma.Decimal('300'), adjustments: [], allocations: [] }, // unpaid: excluded
    ] as never);

    const summary = await supplierService.getSummary(storeManager, supplierId);
    expect(summary).toEqual({
      totalSpend: '1500.5',
      lastPurchaseAt: '2026-09-10T00:00:00.000Z',
      receiptsCount: 2,
      averageDaysToPay: 10,
      priceAlerts: 1,
      shortDeliveries: 1,
    });
  });

  it('returns null average days to pay when nothing is fully paid', async () => {
    const { supplierHistoryRepository } = supplierRepositoryModule;
    vi.mocked(supplierHistoryRepository.summaryReceipts).mockResolvedValue([]);
    vi.mocked(supplierHistoryRepository.summaryInvoices).mockResolvedValue([]);
    const summary = await supplierService.getSummary(director, supplierId);
    expect(summary).toMatchObject({ totalSpend: '0', averageDaysToPay: null, receiptsCount: 0, lastPurchaseAt: null });
  });
});
