import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, 'rules-repository.ts'), 'utf8');

describe('rules repository (static)', () => {
  it('never updates, deletes or upserts a rule version or confirmation', () => {
    expect(source).not.toMatch(/ruleVersion\.(update|updateMany|delete|deleteMany|upsert)\b/);
    expect(source).not.toMatch(/ruleConfirmation\.(update|updateMany|delete|deleteMany|upsert)\b/);
  });

  it('every rule-version and confirmation read carries companyId', () => {
    const queries = source.match(/ruleVersion\.(findFirst|findMany)\(\{[^}]*\}/g) ?? [];
    expect(queries.length).toBeGreaterThan(0);
    for (const query of queries) expect(query, query).toMatch(/companyId/);
  });

  it('the user and site lookups are scoped: by company, or by the id of the thing itself', () => {
    expect(source).toMatch(/findUserNames[\s\S]*companyId/);
    expect(source).toMatch(/findActiveUsers[\s\S]*companyId/);
    expect(source).toMatch(/findSite: \(siteId: string\) => prisma\.site\.findUnique\(\{ where: \{ id: siteId \}/);
  });
});
