import { describe, expect, it } from 'vitest';
import { auditReason, describeItemChange, describeRestockChange, describeSupplierAudit, describeSupplierCreated } from './audit-log-describe';

describe('describeItemChange', () => {
  it('names the item for create, retire and restore, and keeps the summary for edits', () => {
    expect(describeItemChange('CREATED', 'Brown sugar', 'created the item')).toBe('Created Brown sugar');
    expect(describeItemChange('RETIRED', 'Sugar, brown', 'retired the item')).toBe('Retired Sugar, brown');
    expect(describeItemChange('RESTORED', 'Sugar, brown', 'restored the item')).toBe('Restored Sugar, brown');
    expect(describeItemChange('UPDATED', 'Wheat flour', 'changed the pack from 1 bag = 25 kg to 1 bag = 24 kg')).toBe(
      'Wheat flour: changed the pack from 1 bag = 25 kg to 1 bag = 24 kg',
    );
  });
});

describe('describeSupplierAudit', () => {
  it('says what a status change was and finds the reason in the snapshot', () => {
    const after = { status: 'ON_HOLD', reason: 'Away for a month' };
    expect(describeSupplierAudit('STATUS_CHANGED', 'Samrat', { status: 'ACTIVE' }, after, null)).toBe('Samrat: put on hold');
    expect(auditReason(after)).toBe('Away for a month');
    expect(auditReason({ status: 'ACTIVE' })).toBeNull();
    expect(describeSupplierAudit('STATUS_CHANGED', 'Samrat', null, { status: 'ARCHIVED' }, null)).toBe('Samrat: archived');
  });

  it('never prints an account number', () => {
    const before = { type: 'BANK_TRANSFER', accountNumber: '••••4821' };
    const after = { type: 'BANK_TRANSFER', accountNumber: '••••7702', reason: 'Supplier changed bank' };
    const sentence = describeSupplierAudit('PAY_METHOD_UPDATED', 'Samrat', before, after, null);
    expect(sentence).toBe('Samrat: changed the account number on the bank transfer');
    expect(sentence).not.toMatch(/\d/);
  });

  it('names the item for preferred and price rows', () => {
    expect(describeSupplierAudit('PREFERRED_SET', 'Samrat', null, null, 'Brown sugar')).toBe('Samrat: made the preferred supplier for Brown sugar');
    expect(describeSupplierAudit('LINE_PRICE_SET', 'Samrat', { price: '8900' }, { price: '9100' }, 'Brown sugar')).toBe(
      'Samrat: price for Brown sugar set to KES 9,100 (was KES 8,900)',
    );
  });
});

describe('describeRestockChange and creation', () => {
  it('reads a change, a first level and a cleared level', () => {
    expect(describeRestockChange('Kitchen', 'Chapati dough', 'kg', '12.0000', '14.0000')).toBe('Kitchen: Chapati dough 12 → 14 kg');
    expect(describeRestockChange('Central Store', 'Sugar', 'kg', null, '180.0000')).toBe('Central Store: Sugar level set to 180 kg');
    expect(describeRestockChange('Kitchen', 'Oil', 'L', '10.0000', null)).toBe('Kitchen: Oil level cleared (was 10 L)');
  });
  it('names a created supplier with its code', () => {
    expect(describeSupplierCreated('Kagumo Poultry Farm', 'SUPPLIER-0008')).toBe('Created supplier Kagumo Poultry Farm (SUPPLIER-0008)');
  });
});
