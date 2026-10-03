import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { supplierService } from './supplier-service';
import {
  supplierAuditRepository,
  supplierStripRepository,
  supplierContactRepository,
  supplierItemRepository,
  supplierPayMethodRepository,
  supplierRepository,
  supplierItemLookupRepository,
} from './supplier-repository';
import * as supplierRepositoryModule from './supplier-repository';
import { itemChangeRepository } from '../catalog/item-history-repository';
import * as supplierValidators from './supplier-validators';
import { goodsReceiptRepository, referenceCounterRepository } from '../purchasing/receiving-repository';
import { branchRepository } from '../../../repositories/branch-repository';
import { authRepository } from '../../../repositories/auth-repository';
import { socketService } from '../../../sockets/socket-service';
import { fcmService } from '../../../services/fcm-service';
import { prisma } from '../../../config/database';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../utils/errors';
import {
  accountant,
  attendant,
  buildCatalogLine,
  buildContact,
  buildPayMethod,
  buildSupplierRow,
  contactId,
  contactId2,
  director,
  hubOrgId,
  itemId,
  lineId,
  lineId2,
  methodId,
  methodId2,
  otherOrgId,
  storeManager,
  supplierId,
  waiter,
} from './supplier-test-fixtures';

vi.mock('../catalog/item-history-repository', () => ({
  itemChangeRepository: { record: vi.fn(), list: vi.fn(), countAttendantCreatedSince: vi.fn() },
}));
vi.mock('./supplier-repository', async () => (await import('./supplier-test-fixtures')).supplierRepositoryMocks());
vi.mock('../purchasing/receiving-repository', () => ({
  referenceCounterRepository: { nextReference: vi.fn() },
  goodsReceiptRepository: {
    findPackNotOnFileLines: vi.fn(),
    findReceiptsSignedAt: vi.fn().mockResolvedValue([]),
    findPriceAlertLines: vi.fn().mockResolvedValue([]),
    findPreviousSignedAt: vi.fn().mockResolvedValue(null),
  },
}));
vi.mock('../../../repositories/auth-repository', () => ({ authRepository: { findUserById: vi.fn() } }));
vi.mock('../../../sockets/socket-service', () => ({ socketService: { emitChequeMethodAdded: vi.fn(), emitPayMethodChanged: vi.fn() } }));
vi.mock('../../../services/fcm-service', () => ({ fcmService: { sendChequeMethodAddedPush: vi.fn(), sendPayMethodChangedPush: vi.fn() } }));
vi.mock('../../../repositories/branch-repository', () => ({ branchRepository: { findHub: vi.fn() } }));
vi.mock('./supplier-storage', () => ({ getDocumentStorage: vi.fn() }));

const tx = { marker: 'tx' };
vi.mock('../../../config/database', () => ({
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
  vi.mocked(supplierStripRepository.listForStripByIds).mockResolvedValue([]);
  vi.mocked(supplierPayMethodRepository.findHubAccountants).mockResolvedValue([]);
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
    await expect(supplierService.createSupplier(storeManager, { ...validCreate, contacts: [{ name: 'X', role: 'OTHER', isPrimary: true }] })).rejects.toThrow('boom');
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
      supplierService.createSupplier(storeManager, { ...validCreate, name: 'KAGUMO poultry  farm.', contacts: [{ name: 'Kagumo', role: 'OTHER', phone: '+254722410552', isPrimary: true }] }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'DUPLICATE_SUPPLIER' });
    expect(supplierRepository.create).not.toHaveBeenCalled();
  });

  it('proceeds when confirmDuplicate is set', async () => {
    vi.mocked(supplierRepository.findLiveWithPhones).mockResolvedValue([existing]);
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('SUPPLIER-0011');
    await supplierService.createSupplier(storeManager, {
      ...validCreate,
      name: 'Kagumo Poultry Farm',
      contacts: [{ name: 'Kagumo', role: 'OTHER', phone: '0722410552', isPrimary: true }],
      confirmDuplicate: true,
    });
    expect(supplierRepository.create).toHaveBeenCalled();
  });

  it('allows the same name with a different phone', async () => {
    vi.mocked(supplierRepository.findLiveWithPhones).mockResolvedValue([existing]);
    vi.mocked(referenceCounterRepository.nextReference).mockResolvedValue('SUPPLIER-0012');
    await supplierService.createSupplier(storeManager, { ...validCreate, name: 'Kagumo Poultry Farm', contacts: [{ name: 'Kagumo', role: 'OTHER', phone: '0799000111', isPrimary: true }] });
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

describe('supplierService — updating the address', () => {
  it('PATCH address edits the address and leaves the contacts alone', async () => {
    await supplierService.updateSupplier(storeManager, supplierId, { address: 'Karatina' });
    expect(supplierRepository.update).toHaveBeenCalledWith(
      supplierId, hubOrgId, expect.objectContaining({ address: 'Karatina', updatedById: 'sm1' }), tx,
    );
    expect(supplierContactRepository.update).not.toHaveBeenCalled();
    expect(supplierContactRepository.create).not.toHaveBeenCalled();
  });
});

describe('supplierService — who may do what (the Central Store permissions table)', () => {
  const branchManager = { id: 'bm1', role: 'MANAGER' as never, organizationId: otherOrgId };
  const systemAdmin = { id: 'adm1', role: 'SYSTEM_ADMIN' as never, organizationId: null };

  it('lets the Branch Manager read a supplier from a branch, without its payment methods', async () => {
    const detail = (await supplierService.getSupplierById(branchManager, supplierId)) as { paymentMethods: unknown[]; paymentMethodCount: number; name: string };
    expect(detail.name).toBe('Samrat Supermarket Ltd');
    expect(detail.paymentMethods).toEqual([]);
    // The checklist still knows a method is on file.
    expect(detail.paymentMethodCount).toBe(1);
    expect(supplierRepository.findDetailById).toHaveBeenCalledWith(supplierId, hubOrgId);
  });

  it('keeps payment details, the change history and every write from the Branch Manager', async () => {
    await expect(supplierService.listPayMethods(branchManager, supplierId)).rejects.toThrow(ForbiddenError);
    await expect(supplierService.getPayMethod(branchManager, supplierId, methodId)).rejects.toThrow(ForbiddenError);
    await expect(supplierService.listPayMethodHistory(branchManager, supplierId)).rejects.toThrow(ForbiddenError);
    await expect(supplierService.updateSupplier(branchManager, supplierId, { address: 'x' })).rejects.toThrow(ForbiddenError);
    await expect(supplierService.updateStatus(branchManager, supplierId, { status: 'ON_HOLD' })).rejects.toThrow(ForbiddenError);
    await expect(supplierService.createPayMethod(branchManager, supplierId, { type: 'CASH', reason: 'x' } as never)).rejects.toThrow(ForbiddenError);
  });

  it('shows the Director payment details but lets the Director change nothing', async () => {
    vi.mocked(supplierPayMethodRepository.list).mockResolvedValue([buildPayMethod()] as never);
    await expect(supplierService.listPayMethods(director, supplierId)).resolves.toHaveLength(1);
    await expect(supplierService.updateSupplier(director, supplierId, { address: 'x' })).rejects.toThrow(ForbiddenError);
    await expect(supplierService.createPayMethod(director, supplierId, { type: 'CASH', reason: 'x' } as never)).rejects.toThrow(ForbiddenError);
  });

  it('keeps the Accountant to the money jobs: payment methods yes, the supplier profile no', async () => {
    await expect(supplierService.updateSupplier(accountant, supplierId, { address: 'x' })).rejects.toThrow(ForbiddenError);
    await expect(supplierService.deleteDocument(accountant, supplierId, 'doc')).rejects.toThrow(ForbiddenError);
  });

  it('lets the System Admin, who belongs to no organization, change a hub supplier', async () => {
    await supplierService.updateSupplier(systemAdmin, supplierId, { address: 'Karatina' });
    expect(supplierRepository.update).toHaveBeenCalledWith(supplierId, hubOrgId, expect.objectContaining({ address: 'Karatina', updatedById: 'adm1' }), tx);
  });

  it('still refuses a Store Manager standing on a branch organization for a write (D-15)', async () => {
    await expect(supplierService.updateSupplier({ ...storeManager, organizationId: otherOrgId }, supplierId, { address: 'x' })).rejects.toThrow(ForbiddenError);
  });

  it('gives the attendant only the stripped list and the quick add', async () => {
    await expect(supplierService.getSupplierById(attendant, supplierId)).rejects.toThrow(ForbiddenError);
    await expect(supplierService.listPayMethods(attendant, supplierId)).rejects.toThrow(ForbiddenError);
    await expect(supplierService.quickAddSupplier(branchManager, { name: 'X', phone: '0700' })).rejects.toThrow(ForbiddenError);
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
    await supplierService.updateStatus(storeManager, supplierId, { status: 'ACTIVE' });
    expect(supplierRepository.setStatus).toHaveBeenLastCalledWith(supplierId, hubOrgId, 'ACTIVE', 'sm1', tx);
  });

  it('archiving is refused while an invoice is unpaid, and says how many', async () => {
    vi.mocked(supplierRepository.countOpenInvoices).mockResolvedValue(1);
    await expect(supplierService.updateStatus(storeManager, supplierId, { status: 'ARCHIVED' })).rejects.toMatchObject({
      code: 'SUPPLIER_HAS_OPEN_INVOICES',
      details: { openInvoices: 1 },
    });
  });
});

describe('supplierService — cheque payment method (B1)', () => {
  const cheque = {
    type: 'CHEQUE' as const,
    registeredName: 'Samrat Supermarket Ltd',
    bankName: 'Equity Bank',
    note: 'Collect on Fridays',
    reason: 'They asked to be paid by cheque from October',
  };
  const chequeRow = buildPayMethod({
    type: 'CHEQUE', registeredName: 'Samrat Supermarket Ltd', bankName: 'Equity Bank', note: 'Collect on Fridays',
    bankBranch: null, accountName: null, accountNumber: null,
  });

  beforeEach(() => {
    vi.mocked(supplierPayMethodRepository.count).mockResolvedValue(1);
    vi.mocked(supplierPayMethodRepository.create).mockResolvedValue(chequeRow as never);
    vi.mocked(supplierPayMethodRepository.findHubAccountants).mockResolvedValue([{ id: 'acc1' }, { id: 'acc2' }]);
    vi.mocked(authRepository.findUserById).mockResolvedValue({ id: 'sm1', name: 'Joseph Mwangi' } as never);
  });

  it('stores payable-to in registeredName, the bank in bankName and the note', async () => {
    const result = await supplierService.createPayMethod(storeManager, supplierId, cheque);
    expect(vi.mocked(supplierPayMethodRepository.create).mock.calls[0]![3]).toMatchObject({
      type: 'CHEQUE', registeredName: 'Samrat Supermarket Ltd', bankName: 'Equity Bank', note: 'Collect on Fridays', accountNumber: null,
    });
    expect(result).toMatchObject({ type: 'CHEQUE', registeredName: 'Samrat Supermarket Ltd', bankName: 'Equity Bank', note: 'Collect on Fridays' });
  });

  it('writes the audit line "cheque method added" with the reason', async () => {
    await supplierService.createPayMethod(storeManager, supplierId, cheque);
    expect(supplierAuditRepository.create).toHaveBeenCalledWith(
      hubOrgId, supplierId, 'sm1', 'PAY_METHOD_CREATED', methodId, null,
      expect.objectContaining({ type: 'CHEQUE', summary: 'cheque method added', reason: cheque.reason }), tx,
    );
  });

  it('requires a reason, payable-to and bank (400 at the schema)', async () => {
    const { CreatePayMethodSchema } = await import('./supplier-validators');
    expect(CreatePayMethodSchema.safeParse({ ...cheque, reason: undefined }).success).toBe(false);
    expect(CreatePayMethodSchema.safeParse({ ...cheque, reason: '   ' }).success).toBe(false);
    expect(CreatePayMethodSchema.safeParse({ ...cheque, registeredName: '' }).success).toBe(false);
    expect(CreatePayMethodSchema.safeParse({ ...cheque, bankName: undefined }).success).toBe(false);
    expect(CreatePayMethodSchema.safeParse(cheque).success).toBe(true);
    // The note stays optional.
    expect(CreatePayMethodSchema.safeParse({ ...cheque, note: undefined }).success).toBe(true);
  });

  it('every kind of method needs a reason to be added', async () => {
    const { CreatePayMethodSchema } = await import('./supplier-validators');
    expect(CreatePayMethodSchema.safeParse({ type: 'CASH' }).success).toBe(false);
    expect(CreatePayMethodSchema.safeParse({ type: 'CASH', reason: 'Supplier set up' }).success).toBe(true);
  });

  it('notifies every Accountant of the hub (socket + push), never the person who added it', async () => {
    vi.mocked(supplierPayMethodRepository.findHubAccountants).mockResolvedValue([{ id: 'acc1' }, { id: 'sm1' }]);
    await supplierService.createPayMethod(storeManager, supplierId, cheque);
    await vi.waitFor(() => expect(fcmService.sendChequeMethodAddedPush).toHaveBeenCalled());

    expect(supplierPayMethodRepository.findHubAccountants).toHaveBeenCalledWith(hubOrgId);
    expect(socketService.emitChequeMethodAdded).toHaveBeenCalledTimes(1);
    expect(socketService.emitChequeMethodAdded).toHaveBeenCalledWith('acc1', {
      supplierId, supplierName: 'Samrat Supermarket Ltd', addedByName: 'Joseph Mwangi', reason: cheque.reason,
    });
    expect(fcmService.sendChequeMethodAddedPush).toHaveBeenCalledWith(['acc1'], expect.objectContaining({ supplierId }));
  });

  it('a failing notification never fails the request', async () => {
    vi.mocked(supplierPayMethodRepository.findHubAccountants).mockRejectedValue(new Error('db down'));
    await expect(supplierService.createPayMethod(storeManager, supplierId, cheque)).resolves.toMatchObject({ type: 'CHEQUE' });
  });

  it('other kinds are announced with the generic notice, not the cheque one', async () => {
    vi.mocked(supplierPayMethodRepository.create).mockResolvedValue(buildPayMethod({ type: 'CASH' }) as never);
    await supplierService.createPayMethod(storeManager, supplierId, { type: 'CASH', reason: 'Supplier asked for it' });
    await vi.waitFor(() => expect(fcmService.sendPayMethodChangedPush).toHaveBeenCalled());
    expect(socketService.emitChequeMethodAdded).not.toHaveBeenCalled();
    expect(socketService.emitPayMethodChanged).toHaveBeenCalledWith('acc1', {
      supplierId, supplierName: 'Samrat Supermarket Ltd', changedByName: 'Joseph Mwangi', summary: 'Added cash', reason: 'Supplier asked for it',
    });
    expect(supplierAuditRepository.create).toHaveBeenCalledWith(
      hubOrgId, supplierId, 'sm1', 'PAY_METHOD_CREATED', methodId, null,
      expect.objectContaining({ type: 'CASH', reason: 'Supplier asked for it' }), tx,
    );
  });

  it('a cheque method can be edited (payable to, bank, note) and is re-validated', async () => {
    vi.mocked(supplierPayMethodRepository.findById)
      .mockResolvedValueOnce(chequeRow as never)
      .mockResolvedValueOnce(buildPayMethod({ ...chequeRow, note: 'Post it' }) as never);
    await supplierService.updatePayMethod(storeManager, supplierId, methodId, { note: 'Post it' });
    expect(vi.mocked(supplierPayMethodRepository.update).mock.calls[0]![3]).toMatchObject({ type: 'CHEQUE', note: 'Post it', bankName: 'Equity Bank' });

    vi.mocked(supplierPayMethodRepository.findById).mockResolvedValueOnce(chequeRow as never);
    await expect(supplierService.updatePayMethod(storeManager, supplierId, methodId, { bankName: '' })).rejects.toThrow();
  });

  it('only Store Manager and Accountant may add one', async () => {
    for (const who of [director, waiter, attendant]) {
      await expect(supplierService.createPayMethod(who, supplierId, cheque)).rejects.toThrow(ForbiddenError);
    }
  });
});

describe('supplierService — catalog, pack lines and preferred sync', () => {
  const line = (overrides: Record<string, unknown> = {}) => buildCatalogLine(overrides);
  const bag = line({ id: lineId, buyUnit: 'bag', packSize: new Prisma.Decimal('50'), supplierItemName: 'Kabras sugar 50kg', supplierItemCode: '190035' });
  const packet = line({ id: lineId2, buyUnit: 'packet', packSize: new Prisma.Decimal('2') });

  beforeEach(() => {
    vi.mocked(supplierItemLookupRepository.findLiveItem).mockResolvedValue({ id: itemId, name: 'Sugar', buyUnit: 'crate' } as never);
    vi.mocked(supplierItemRepository.findByKey).mockResolvedValue(null);
    vi.mocked(supplierItemRepository.findById).mockResolvedValue(line() as never);
    vi.mocked(supplierItemRepository.createLine).mockResolvedValue(line() as never);
    vi.mocked(supplierItemRepository.updateLine).mockResolvedValue(line() as never);
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([]);
    vi.mocked(supplierItemRepository.applyPreferred).mockResolvedValue({ lineId, wasPreferred: false, wasNeedsConfirm: false });
  });

  // --- B3: add one -----------------------------------------------------------

  it('add-one creates a line keyed by the item buy unit when no pack is given', async () => {
    const result = await supplierService.addItem(storeManager, supplierId, { inventoryItemId: itemId });
    expect(supplierItemRepository.findByKey).toHaveBeenCalledWith(supplierId, itemId, hubOrgId, { buyUnit: 'crate', packSize: null }, tx);
    expect(supplierItemRepository.createLine).toHaveBeenCalledWith(
      hubOrgId, supplierId, itemId, expect.objectContaining({ buyUnit: 'crate', packSize: null }), tx,
    );
    expect(result).toMatchObject({ id: lineId, inventoryItemId: itemId, preferredNeedsConfirm: false });
  });

  it('add-one stores their name and code (B5)', async () => {
    await supplierService.addItem(storeManager, supplierId, {
      inventoryItemId: itemId, supplierItemName: 'Kabras sugar 50kg', supplierItemCode: '190035', buyUnit: 'bag', packSize: '50',
    });
    expect(vi.mocked(supplierItemRepository.createLine).mock.calls[0]![3]).toMatchObject({
      supplierItemName: 'Kabras sugar 50kg', supplierItemCode: '190035', buyUnit: 'bag', packSize: '50',
    });
  });

  it('two pack lines for one supplier and item are allowed when the key differs', async () => {
    vi.mocked(supplierItemRepository.findByKey).mockResolvedValue(null); // 2 kg packet is not on file
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([bag] as never);
    await supplierService.addItem(storeManager, supplierId, { inventoryItemId: itemId, buyUnit: 'packet', packSize: '2' });
    expect(supplierItemRepository.createLine).toHaveBeenCalledTimes(1);
  });

  it('add-one on an existing key is a 409 naming the existing line', async () => {
    vi.mocked(supplierItemRepository.findByKey).mockResolvedValue(bag as never);
    const error = await supplierService
      .addItem(storeManager, supplierId, { inventoryItemId: itemId, buyUnit: 'bag', packSize: '50' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: 'PACK_LINE_EXISTS' });
    expect((error as Error).message).toContain('Samrat Supermarket Ltd already has this pack: Kabras sugar 50kg · bag · 50 (their code 190035)');
    expect(supplierItemRepository.createLine).not.toHaveBeenCalled();
  });

  it('add-one is an owner-hub, Store Manager action', async () => {
    await expect(supplierService.addItem(attendant, supplierId, { inventoryItemId: itemId })).rejects.toThrow(ForbiddenError);
    await expect(
      supplierService.addItem({ ...storeManager, organizationId: otherOrgId }, supplierId, { inventoryItemId: itemId }),
    ).rejects.toThrow(ForbiddenError);
  });

  // --- B3: put -----------------------------------------------------------------

  it('put with a named pack that already exists updates that line (Add several never duplicates)', async () => {
    vi.mocked(supplierItemRepository.findByKey).mockResolvedValue(bag as never);
    await supplierService.putItem(storeManager, supplierId, itemId, { buyUnit: 'bag', packSize: '50', supplierItemCode: '190035' });
    expect(supplierItemRepository.createLine).not.toHaveBeenCalled();
    expect(supplierItemRepository.updateLine).toHaveBeenCalledWith(lineId, hubOrgId, { supplierItemCode: '190035' }, tx);
  });

  it('put with a named pack that is new creates a second line', async () => {
    await supplierService.putItem(storeManager, supplierId, itemId, { buyUnit: 'packet', packSize: '2' });
    expect(supplierItemRepository.createLine).toHaveBeenCalledWith(
      hubOrgId, supplierId, itemId, expect.objectContaining({ buyUnit: 'packet', packSize: '2' }), tx,
    );
  });

  it('put with a lineId edits that line; moving its key onto another line is a 409', async () => {
    vi.mocked(supplierItemRepository.findById).mockResolvedValue(packet as never);
    vi.mocked(supplierItemRepository.findByKey).mockResolvedValue(bag as never); // the 50 kg bag already exists
    await expect(
      supplierService.putItem(storeManager, supplierId, itemId, { lineId: lineId2, buyUnit: 'bag', packSize: '50' }),
    ).rejects.toMatchObject({ code: 'PACK_LINE_EXISTS' });
    expect(supplierItemRepository.updateLine).not.toHaveBeenCalled();
  });

  it('put with a lineId changes only the fields sent and may keep its own key', async () => {
    vi.mocked(supplierItemRepository.findById).mockResolvedValue(bag as never);
    await supplierService.putItem(storeManager, supplierId, itemId, { lineId, supplierItemName: 'Sugar 50kg', buyUnit: 'bag', packSize: '50' });
    expect(supplierItemRepository.findByKey).not.toHaveBeenCalled();
    expect(supplierItemRepository.updateLine).toHaveBeenCalledWith(
      lineId, hubOrgId, { supplierItemName: 'Sugar 50kg', buyUnit: 'bag', packSize: '50' }, tx,
    );
  });

  it('put with a lineId that is not this supplier\'s line for the item is a 404', async () => {
    vi.mocked(supplierItemRepository.findById).mockResolvedValue(null);
    await expect(supplierService.putItem(storeManager, supplierId, itemId, { lineId, supplierItemName: 'x' })).rejects.toThrow(NotFoundError);
  });

  it('legacy put (no pack, no lineId) targets the oldest line and leaves its name alone', async () => {
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([bag, packet] as never);
    vi.mocked(supplierItemRepository.findById).mockResolvedValue(bag as never);
    await supplierService.putItem(storeManager, supplierId, itemId, { isPreferred: true });
    expect(supplierItemRepository.updateLine).not.toHaveBeenCalled();
    expect(supplierItemRepository.createLine).not.toHaveBeenCalled();
    expect(supplierItemRepository.applyPreferred).toHaveBeenCalledWith(hubOrgId, itemId, supplierId, tx, lineId);
  });

  it('legacy put with no line yet creates one keyed by the item buy unit', async () => {
    await supplierService.putItem(storeManager, supplierId, itemId, { supplierItemName: 'Fresh milk' });
    expect(supplierItemRepository.createLine).toHaveBeenCalledWith(
      hubOrgId, supplierId, itemId, expect.objectContaining({ supplierItemName: 'Fresh milk', buyUnit: 'crate', packSize: null }), tx,
    );
  });

  it('a unique-index race surfaces as a 409, not a 500', async () => {
    const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/library');
    vi.mocked(supplierItemRepository.createLine).mockRejectedValue(
      new PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(supplierService.addItem(storeManager, supplierId, { inventoryItemId: itemId })).rejects.toThrow(ConflictError);
  });

  it('404s on an unknown or retired catalog item', async () => {
    vi.mocked(supplierItemLookupRepository.findLiveItem).mockResolvedValue(null);
    await expect(supplierService.putItem(storeManager, supplierId, itemId, {})).rejects.toThrow(NotFoundError);
    await expect(supplierService.addItem(storeManager, supplierId, { inventoryItemId: itemId })).rejects.toThrow(NotFoundError);
  });

  // --- B8: preferred -----------------------------------------------------------

  it('marking preferred makes that line the single preferred one and logs PREFERRED_SET', async () => {
    await supplierService.putItem(storeManager, supplierId, itemId, { isPreferred: true, lineId });
    expect(supplierItemRepository.applyPreferred).toHaveBeenCalledWith(hubOrgId, itemId, supplierId, tx, lineId);
    expect(supplierAuditRepository.create).toHaveBeenCalledWith(
      hubOrgId, supplierId, 'sm1', 'PREFERRED_SET', lineId,
      expect.objectContaining({ lineId }), expect.objectContaining({ isPreferred: true, preferredNeedsConfirm: false }), tx,
    );
  });

  it('confirming a "Preferred · confirm" line clears the mark and logs PREFERRED_CONFIRMED', async () => {
    vi.mocked(supplierItemRepository.applyPreferred).mockResolvedValue({ lineId, wasPreferred: true, wasNeedsConfirm: true });
    await supplierService.putItem(storeManager, supplierId, itemId, { isPreferred: true, lineId });
    expect(supplierAuditRepository.create).toHaveBeenCalledWith(
      hubOrgId, supplierId, 'sm1', 'PREFERRED_CONFIRMED', lineId,
      expect.objectContaining({ preferredNeedsConfirm: true }), expect.objectContaining({ preferredNeedsConfirm: false }), tx,
    );
  });

  it('re-sending preferred on a line that is already confirmed logs nothing', async () => {
    vi.mocked(supplierItemRepository.applyPreferred).mockResolvedValue({ lineId, wasPreferred: true, wasNeedsConfirm: false });
    await supplierService.putItem(storeManager, supplierId, itemId, { isPreferred: true, lineId });
    expect(supplierAuditRepository.create).not.toHaveBeenCalled();
  });

  it('add-one can create the line as preferred', async () => {
    await supplierService.addItem(storeManager, supplierId, { inventoryItemId: itemId, isPreferred: true });
    expect(supplierItemRepository.applyPreferred).toHaveBeenCalledWith(hubOrgId, itemId, supplierId, tx, lineId);
  });

  it("un-marking clears only this line's preferred mark", async () => {
    await supplierService.putItem(storeManager, supplierId, itemId, { isPreferred: false, lineId });
    expect(supplierItemRepository.clearPreferredIfSupplier).toHaveBeenCalledWith(hubOrgId, itemId, supplierId, tx, lineId);
    expect(supplierItemRepository.applyPreferred).not.toHaveBeenCalled();
  });

  it('leaves the preferred flag alone when not sent', async () => {
    await supplierService.putItem(storeManager, supplierId, itemId, { supplierItemName: 'Fresh milk' });
    expect(supplierItemRepository.applyPreferred).not.toHaveBeenCalled();
    expect(supplierItemRepository.clearPreferredIfSupplier).not.toHaveBeenCalled();
    expect(supplierAuditRepository.create).not.toHaveBeenCalled();
  });

  it('returns preferredNeedsConfirm on the catalog rows', async () => {
    vi.mocked(supplierItemRepository.list).mockResolvedValue([line({ isPreferred: true, preferredNeedsConfirm: true })] as never);
    const [row] = await supplierService.listItems(storeManager, supplierId);
    expect(row).toMatchObject({ id: lineId, isPreferred: true, preferredNeedsConfirm: true });
  });

  // --- delete -------------------------------------------------------------------

  it('deleting the only line clears its preferred mark and removes it', async () => {
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([line()] as never);
    await supplierService.deleteItem(storeManager, supplierId, itemId);
    expect(supplierItemRepository.clearPreferredIfSupplier).toHaveBeenCalledWith(hubOrgId, itemId, supplierId, tx, undefined);
    expect(supplierItemRepository.delete).toHaveBeenCalledWith(supplierId, itemId, hubOrgId, tx, undefined);
  });

  it('with several pack lines, deleting without a lineId is a 409; with one it removes only that line', async () => {
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([bag, packet] as never);
    await expect(supplierService.deleteItem(storeManager, supplierId, itemId)).rejects.toMatchObject({ code: 'MULTIPLE_PACK_LINES' });
    expect(supplierItemRepository.delete).not.toHaveBeenCalled();

    await supplierService.deleteItem(storeManager, supplierId, itemId, lineId2);
    expect(supplierItemRepository.delete).toHaveBeenCalledWith(supplierId, itemId, hubOrgId, tx, lineId2);
  });

  it('deleting a missing row or a foreign lineId is a 404', async () => {
    await expect(supplierService.deleteItem(storeManager, supplierId, itemId)).rejects.toThrow(NotFoundError);
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([bag] as never);
    await expect(supplierService.deleteItem(storeManager, supplierId, itemId, lineId2)).rejects.toThrow(NotFoundError);
  });
});

describe('supplierService — pack mismatches (B4 surface)', () => {
  const flagged = (overrides: Record<string, unknown> = {}) => ({
    id: 'grl1',
    inventoryItemId: itemId,
    packBuyUnit: 'packet',
    packSize: new Prisma.Decimal('2'),
    unitPrice: new Prisma.Decimal('130'),
    packNotOnFile: true,
    goodsReceipt: { id: 'gr1', reference: 'GRN-0007', signedAt: new Date('2026-10-01T09:00:00.000Z') },
    inventoryItem: { name: 'Sugar white' },
    ...overrides,
  });

  it('lists flagged receipt lines that still match no catalog line', async () => {
    vi.mocked(goodsReceiptRepository.findPackNotOnFileLines).mockResolvedValue([flagged()] as never);
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([
      buildCatalogLine({ buyUnit: 'bag', packSize: new Prisma.Decimal('50') }),
    ] as never);

    const rows = await supplierService.listPackMismatches(storeManager, supplierId);
    expect(rows).toEqual([
      {
        receiptLineId: 'grl1', goodsReceiptId: 'gr1', reference: 'GRN-0007', signedAt: '2026-10-01T09:00:00.000Z',
        inventoryItemId: itemId, itemName: 'Sugar white', packBuyUnit: 'packet', packSize: '2', unitPrice: '130',
      },
    ]);
    expect(goodsReceiptRepository.findPackNotOnFileLines).toHaveBeenCalledWith(supplierId, hubOrgId);
  });

  it('drops a row once the missing pack has been added to the catalog', async () => {
    vi.mocked(goodsReceiptRepository.findPackNotOnFileLines).mockResolvedValue([flagged()] as never);
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([
      buildCatalogLine({ buyUnit: 'bag', packSize: new Prisma.Decimal('50') }),
      buildCatalogLine({ id: lineId2, buyUnit: 'packet', packSize: new Prisma.Decimal('2') }),
    ] as never);
    expect(await supplierService.listPackMismatches(storeManager, supplierId)).toEqual([]);
  });

  it('is empty without touching the catalog when nothing is flagged', async () => {
    vi.mocked(goodsReceiptRepository.findPackNotOnFileLines).mockResolvedValue([]);
    expect(await supplierService.listPackMismatches(storeManager, supplierId)).toEqual([]);
    expect(supplierItemRepository.listBySupplierItems).not.toHaveBeenCalled();
  });

  it('is closed to attendants and other organisations', async () => {
    await expect(supplierService.listPackMismatches(attendant, supplierId)).rejects.toThrow(ForbiddenError);
    await expect(
      supplierService.listPackMismatches({ ...storeManager, organizationId: otherOrgId }, supplierId),
    ).rejects.toThrow(ForbiddenError);
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

describe('supplierService — hand-set price and item history (§30.3, §30.4)', () => {
  const line = (overrides: Record<string, unknown> = {}) => buildCatalogLine(overrides);

  beforeEach(() => {
    vi.mocked(supplierItemLookupRepository.findLiveItem).mockResolvedValue({ id: itemId, name: 'Sugar', buyUnit: 'bag', usageUnit: 'kg' } as never);
    vi.mocked(supplierItemRepository.findByKey).mockResolvedValue(null);
    vi.mocked(supplierItemRepository.findById).mockResolvedValue(line({ lastPrice: new Prisma.Decimal('2025') }) as never);
    vi.mocked(supplierItemRepository.createLine).mockResolvedValue(line({ lastPrice: null, buyUnit: 'bag', packSize: new Prisma.Decimal('50') }) as never);
    vi.mocked(supplierItemRepository.updateLine).mockResolvedValue(line() as never);
    vi.mocked(supplierItemRepository.listBySupplierItems).mockResolvedValue([]);
    vi.mocked(supplierItemRepository.applyPreferred).mockResolvedValue({ lineId, wasPreferred: false, wasNeedsConfirm: false });
  });

  const priceWrites = () =>
    vi.mocked(supplierItemRepository.updateLine).mock.calls.filter(([, , data]) => (data as { lastPrice?: unknown }).lastPrice !== undefined);

  it('add-one with a price sets it by hand: who and when, a supplier audit row, one SUPPLIER_ADDED history row', async () => {
    await supplierService.addItem(storeManager, supplierId, { inventoryItemId: itemId, buyUnit: 'bag', packSize: '50', price: '8900', isPreferred: true });

    expect(priceWrites()).toHaveLength(1);
    expect(priceWrites()[0]![2]).toMatchObject({ lastPrice: '8900', lastPriceSetById: 'sm1' });
    expect((priceWrites()[0]![2] as { lastPriceAt: Date }).lastPriceAt).toBeInstanceOf(Date);
    expect(supplierAuditRepository.create).toHaveBeenCalledWith(
      hubOrgId, supplierId, 'sm1', 'LINE_PRICE_SET', lineId,
      { inventoryItemId: itemId, lineId, price: null }, { inventoryItemId: itemId, lineId, price: '8900' }, tx,
    );
    expect(itemChangeRepository.record).toHaveBeenCalledTimes(1);
    const record = vi.mocked(itemChangeRepository.record).mock.calls[0]![1];
    expect(record).toMatchObject({ kind: 'SUPPLIER_ADDED', inventoryItemId: itemId, changedById: 'sm1', organizationId: hubOrgId });
    expect(record.summary).toMatch(/^added .+ \(bag of 50 kg\) at KES 8,900 per bag, preferred$/);
  });

  it('add-one without a price writes no price and still records the supplier as added', async () => {
    await supplierService.addItem(storeManager, supplierId, { inventoryItemId: itemId });
    expect(priceWrites()).toHaveLength(0);
    expect(supplierAuditRepository.create).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), 'LINE_PRICE_SET', expect.anything(), expect.anything(), expect.anything(), expect.anything());
    expect(vi.mocked(itemChangeRepository.record).mock.calls[0]![1].summary).not.toContain('KES');
  });

  it('put on an existing line with a new price: LINE_PRICE_SET (old to new) and a SUPPLIER_PRICE_SET history row', async () => {
    await supplierService.putItem(storeManager, supplierId, itemId, { lineId, price: '2100' });

    expect(priceWrites()[0]![2]).toMatchObject({ lastPrice: '2100', lastPriceSetById: 'sm1' });
    expect(supplierAuditRepository.create).toHaveBeenCalledWith(
      hubOrgId, supplierId, 'sm1', 'LINE_PRICE_SET', lineId,
      { inventoryItemId: itemId, lineId, price: '2025' }, { inventoryItemId: itemId, lineId, price: '2100' }, tx,
    );
    const record = vi.mocked(itemChangeRepository.record).mock.calls[0]![1];
    expect(record).toMatchObject({ kind: 'SUPPLIER_PRICE_SET', before: { lineId, price: '2025' }, after: { lineId, price: '2100' } });
    expect(record.summary).toMatch(/price to KES 2,100 per crate \(was KES 2,025\)$/);
  });

  it('put with the price the line already has writes nothing', async () => {
    await supplierService.putItem(storeManager, supplierId, itemId, { lineId, price: '2025' });
    expect(priceWrites()).toHaveLength(0);
    expect(supplierAuditRepository.create).not.toHaveBeenCalled();
    expect(itemChangeRepository.record).not.toHaveBeenCalled();
  });

  it('a put that creates the line records it as added, with the price in the sentence', async () => {
    vi.mocked(supplierItemRepository.createLine).mockResolvedValue(line({ lastPrice: null, buyUnit: 'packet', packSize: new Prisma.Decimal('2') }) as never);
    await supplierService.putItem(storeManager, supplierId, itemId, { buyUnit: 'packet', packSize: '2', price: '380' });

    const record = vi.mocked(itemChangeRepository.record).mock.calls[0]![1];
    expect(record.kind).toBe('SUPPLIER_ADDED');
    expect(record.summary).toContain('(packet of 2 kg) at KES 380 per packet');
    expect(priceWrites()[0]![2]).toMatchObject({ lastPrice: '380' });
  });

  it('rejects a price that is not a positive amount (the schema), and a price cannot be cleared with null', () => {
    const { CreateSupplierItemSchema, PutSupplierItemSchema } = supplierValidators;
    expect(CreateSupplierItemSchema.safeParse({ inventoryItemId: itemId, price: '0' }).success).toBe(false);
    expect(CreateSupplierItemSchema.safeParse({ inventoryItemId: itemId, price: '-5' }).success).toBe(false);
    expect(PutSupplierItemSchema.safeParse({ price: null }).success).toBe(false);
    expect(PutSupplierItemSchema.safeParse({ price: '8900.5' }).success).toBe(true);
  });
});

describe('supplierService.listSuppliers — profile and owed on each row', () => {
  const stripFor = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    name: 'Samrat',
    type: 'REGULAR',
    status: 'ACTIVE',
    address: 'Nyeri',
    kraPin: null,
    contacts: [{ name: 'Rajesh', phone: '0722', isPrimary: true }],
    _count: { payMethods: 0 },
    supplierInvoices: [
      { amountBilled: new Prisma.Decimal('1000'), adjustments: [], allocations: [{ amount: new Prisma.Decimal('400') }] },
      { amountBilled: new Prisma.Decimal('300'), adjustments: [], allocations: [{ amount: new Prisma.Decimal('300') }] },
    ],
    ...over,
  });

  it('adds profileDone and owedAmount, counting only invoices with a balance', async () => {
    vi.mocked(supplierRepository.findAllByOrganization).mockResolvedValue({ suppliers: [buildSupplierRow()], total: 1 } as never);
    vi.mocked(supplierStripRepository.listForStripByIds).mockResolvedValue([stripFor(buildSupplierRow().id)] as never);
    const { data } = await supplierService.listSuppliers(storeManager, { page: 1, perPage: 20, includeRetired: false });
    // name, type, phone, address, contact person pass; no payment details, no KRA PIN.
    expect(data[0]).toMatchObject({ profileDone: 5, owedAmount: '600.00' });
    expect(supplierStripRepository.listForStripByIds).toHaveBeenCalledWith(hubOrgId, [buildSupplierRow().id]);
  });

  it('profileNotFinished limits the list to suppliers missing a check, before paging', async () => {
    vi.mocked(supplierStripRepository.listForStrip).mockResolvedValue([
      stripFor('unfinished'),
      stripFor('finished', { kraPin: 'P1', _count: { payMethods: 1 } }),
    ] as never);
    vi.mocked(supplierRepository.findAllByOrganization).mockResolvedValue({ suppliers: [], total: 0 } as never);
    await supplierService.listSuppliers(storeManager, { page: 1, perPage: 20, includeRetired: false, profileNotFinished: true });
    expect(vi.mocked(supplierRepository.findAllByOrganization).mock.calls[0]![1].ids).toEqual(['unfinished']);
  });

  it('a supplier with no strip row reads 0 of 7 and nothing owed rather than failing the list', async () => {
    vi.mocked(supplierRepository.findAllByOrganization).mockResolvedValue({ suppliers: [buildSupplierRow()], total: 1 } as never);
    const { data } = await supplierService.listSuppliers(storeManager, { page: 1, perPage: 20, includeRetired: false });
    expect(data[0]).toMatchObject({ profileDone: 0, owedAmount: '0.00' });
  });

  it('attendants get neither figure and never trigger the profile lookup', async () => {
    vi.mocked(supplierRepository.findAllByOrganization).mockResolvedValue({ suppliers: [buildSupplierRow()], total: 1 } as never);
    const { data } = await supplierService.listSuppliers(attendant, { page: 1, perPage: 20, includeRetired: false, profileNotFinished: true });
    expect(JSON.stringify(data)).not.toMatch(/profileDone|owedAmount/);
    expect(supplierStripRepository.listForStrip).not.toHaveBeenCalled();
    expect(supplierStripRepository.listForStripByIds).not.toHaveBeenCalled();
    expect(vi.mocked(supplierRepository.findAllByOrganization).mock.calls[0]![1].ids).toBeUndefined();
  });
});

describe('supplierService — changing payment details needs a reason and tells the Accountant (§30.10)', () => {
  const bank = buildPayMethod({ type: 'BANK_TRANSFER', accountNumber: '0170291548212', accountName: 'Samrat Ltd', bankName: 'Equity', bankBranch: 'Nyeri' });
  const bankAfter = { ...bank, accountNumber: '0170291577702' };

  beforeEach(() => {
    vi.mocked(supplierPayMethodRepository.findById).mockResolvedValueOnce(bank as never).mockResolvedValueOnce(bankAfter as never);
    vi.mocked(supplierPayMethodRepository.findHubAccountants).mockResolvedValue([{ id: 'acc1' }]);
    vi.mocked(authRepository.findUserById).mockResolvedValue({ id: 'sm1', name: 'Joseph Mwangi' } as never);
  });

  it('the schema asks for a reason unless only the default flag is toggled', async () => {
    const { UpdatePayMethodSchema } = await import('./supplier-validators');
    expect(UpdatePayMethodSchema.safeParse({ accountNumber: '1' }).success).toBe(false);
    expect(UpdatePayMethodSchema.safeParse({ accountNumber: '1', reason: '  ' }).success).toBe(false);
    expect(UpdatePayMethodSchema.safeParse({ accountNumber: '1', reason: 'Supplier changed bank' }).success).toBe(true);
    expect(UpdatePayMethodSchema.safeParse({ isDefault: true }).success).toBe(true);
    expect(UpdatePayMethodSchema.safeParse({ reason: 'only a reason' }).success).toBe(false);
  });

  it('keeps the reason in the audit row, never the number, and tells the Accountant in words', async () => {
    await supplierService.updatePayMethod(storeManager, supplierId, methodId, { accountNumber: '0170291577702', reason: 'Supplier changed bank' });
    const [, , , action, , before, after] = vi.mocked(supplierAuditRepository.create).mock.calls[0]!;
    expect(action).toBe('PAY_METHOD_UPDATED');
    expect(JSON.stringify([before, after])).not.toContain('0170291577702');
    expect(after).toMatchObject({ reason: 'Supplier changed bank' });
    await vi.waitFor(() => expect(socketService.emitPayMethodChanged).toHaveBeenCalled());
    expect(socketService.emitPayMethodChanged).toHaveBeenCalledWith('acc1', {
      supplierId, supplierName: 'Samrat Supermarket Ltd', changedByName: 'Joseph Mwangi',
      summary: 'Changed the account number on the bank transfer', reason: 'Supplier changed bank',
    });
  });

  it('making a method the default tells nobody', async () => {
    await supplierService.updatePayMethod(storeManager, supplierId, methodId, { isDefault: true });
    expect(socketService.emitPayMethodChanged).not.toHaveBeenCalled();
  });
});

describe('supplierService.listPayMethodHistory', () => {
  const row = (over: Record<string, unknown>) => ({
    id: 'a1', createdAt: new Date('2026-10-12T11:08:00Z'), action: 'PAY_METHOD_CREATED', before: null,
    after: { type: 'CHEQUE', registeredName: 'Samrat Supermarket Ltd', reason: 'Supplier asked for it' },
    actor: { id: 'sm1', name: 'Isabel Njoki' }, ...over,
  });

  it('turns audit rows into plain sentences with who, when and why', async () => {
    vi.mocked(supplierAuditRepository.listPayMethodChanges).mockResolvedValue([
      row({}),
      row({ id: 'a2', action: 'PAY_METHOD_UPDATED', before: { type: 'BANK_TRANSFER', accountNumber: '••••4821' }, after: { type: 'BANK_TRANSFER', accountNumber: '••••7702' } }),
    ] as never);
    const history = await supplierService.listPayMethodHistory(accountant, supplierId);
    expect(history).toEqual([
      { id: 'a1', at: '2026-10-12T11:08:00.000Z', action: 'PAY_METHOD_CREATED', summary: 'Added cheque, payable to Samrat Supermarket Ltd', reason: 'Supplier asked for it', actor: { id: 'sm1', name: 'Isabel Njoki' } },
      { id: 'a2', at: '2026-10-12T11:08:00.000Z', action: 'PAY_METHOD_UPDATED', summary: 'Changed the account number on the bank transfer', reason: null, actor: { id: 'sm1', name: 'Isabel Njoki' } },
    ]);
    expect(supplierAuditRepository.listPayMethodChanges).toHaveBeenCalledWith(supplierId, hubOrgId, 50);
  });

  it('is closed to the attendant and anyone outside the hub', async () => {
    await expect(supplierService.listPayMethodHistory(attendant, supplierId)).rejects.toThrow(ForbiddenError);
    expect(supplierAuditRepository.listPayMethodChanges).not.toHaveBeenCalled();
  });
});

describe('supplierService.listItems — the Catalog tab extras (§30.11)', () => {
  it('adds the usage unit, the receipt behind the price and the price alert with the date it compares with', async () => {
    const signedAt = new Date('2026-10-08T09:00:00Z');
    vi.mocked(supplierItemRepository.list).mockResolvedValue([
      buildCatalogLine({
        buyUnit: 'bag', packSize: new Prisma.Decimal('50'), lastPriceAt: signedAt,
        inventoryItem: { id: itemId, name: 'Sugar, white', buyUnit: 'bag', usageUnit: 'kg', conversionFactor: new Prisma.Decimal('50') },
      }),
    ] as never);
    vi.mocked(goodsReceiptRepository.findReceiptsSignedAt).mockResolvedValue([{ id: 'r1', reference: 'GRN-1042', signedAt, itemIds: [itemId] }] as never);
    vi.mocked(goodsReceiptRepository.findPriceAlertLines).mockResolvedValue([
      { inventoryItemId: itemId, packBuyUnit: 'bag', packSize: new Prisma.Decimal('50'), priceAlertPct: new Prisma.Decimal('6'), priceAlertPrevPrice: new Prisma.Decimal('8630'), signedAt },
    ] as never);
    vi.mocked(goodsReceiptRepository.findPreviousSignedAt).mockResolvedValue(new Date('2026-09-28T09:00:00Z'));

    const [row] = await supplierService.listItems(storeManager, supplierId);
    expect(row).toMatchObject({
      itemUsageUnit: 'kg', itemConversionFactor: '50',
      lastReceipt: { id: 'r1', reference: 'GRN-1042' },
      priceAlert: { pct: '6', previousPrice: '8630', previousAt: '2026-09-28T09:00:00.000Z' },
    });
    expect(goodsReceiptRepository.findPriceAlertLines).toHaveBeenCalledWith(supplierId, hubOrgId, expect.any(Date));
  });

  it('a line with no receipts and no alerts reads null for both', async () => {
    vi.mocked(supplierItemRepository.list).mockResolvedValue([buildCatalogLine()] as never);
    vi.mocked(goodsReceiptRepository.findReceiptsSignedAt).mockResolvedValue([]);
    vi.mocked(goodsReceiptRepository.findPriceAlertLines).mockResolvedValue([]);
    const [row] = await supplierService.listItems(storeManager, supplierId);
    expect(row).toMatchObject({ lastReceipt: null, priceAlert: null });
  });
});
