import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../config/database', () => ({ prisma: { $transaction: vi.fn() } }));

import { writeAuditEntry } from './audit-writer';
import { AUDIT_ACTIONS } from './audit-actions';
import { AUDIT_CATEGORIES, type AuditEntryInput } from './audit.types';

const input = (over: Partial<AuditEntryInput>): AuditEntryInput => ({
  companyId: 'c1',
  siteId: null,
  actor: { id: 'u1', role: 'DIRECTOR', name: 'D' },
  action: 'rules.version_created',
  category: 'RULES_OPERATING',
  subjectType: 'RuleVersion',
  subjectId: 'v1',
  ...over,
});

describe('action registry', () => {
  it('refuses an unregistered action', async () => {
    await expect(writeAuditEntry({} as never, input({ action: 'made.up' }))).rejects.toMatchObject({ statusCode: 400, code: 'AUDIT_ACTION_UNREGISTERED' });
  });

  it('refuses a category the action does not allow', async () => {
    await expect(writeAuditEntry({} as never, input({ action: 'rules.version_confirmed', category: 'RULES_OPERATING' }))).rejects.toMatchObject({
      code: 'AUDIT_CATEGORY_NOT_ALLOWED',
    });
  });

  it('every registered category is a real category', () => {
    for (const categories of Object.values(AUDIT_ACTIONS)) for (const category of categories) expect(AUDIT_CATEGORIES).toContain(category);
  });

  it('AUDIT_CATEGORIES equals the Prisma AuditCategory enum', () => {
    const schema = readFileSync(join(__dirname, '../../../../../prisma/schema/workforce.prisma'), 'utf8');
    const body = /enum AuditCategory \{([^}]*)\}/.exec(schema)?.[1] ?? '';
    const values = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('//'));
    expect(values).toEqual([...AUDIT_CATEGORIES]);
  });
});
