import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const reads = readFileSync(join(__dirname, 'rules-repository.ts'), 'utf8');
const writes = readFileSync(join(__dirname, '../versions/versions-repository.ts'), 'utf8');

describe('rules repositories (static)', () => {
  it.each([
    ['reads', reads],
    ['writes', writes],
  ])('the %s never update, delete or upsert a version, a confirmation or a withdrawal', (_name, source) => {
    expect(source).not.toMatch(/ruleVersion\.(update|updateMany|delete|deleteMany|upsert)\b/);
    expect(source).not.toMatch(/ruleConfirmation\.(update|updateMany|delete|deleteMany|upsert)\b/);
    expect(source).not.toMatch(/ruleVersionWithdrawal\.(update|updateMany|delete|deleteMany|upsert)\b/);
  });

  it('every rule-version read carries companyId', () => {
    const queries = reads.match(/ruleVersion\.(findFirst|findMany|count)\(\{[^}]*\}/g) ?? [];
    expect(queries.length).toBeGreaterThan(5);
    for (const query of queries) expect(query, query).toMatch(/companyId/);
  });

  it('the user and site lookups are scoped: by company, or by the id of the thing itself', () => {
    expect(reads).toMatch(/findUserNames[\s\S]*companyId/);
    expect(reads).toMatch(/findActiveUsers[\s\S]*companyId/);
    expect(reads).toMatch(/findHeadUserIds[\s\S]*companyId/);
    expect(reads).toMatch(/findSite: \(siteId: string\) => prisma\.site\.findUnique\(\{ where: \{ id: siteId \}/);
  });

  it('a withdrawn version is skipped by every question about what is in force or what comes next', () => {
    for (const name of ['findEffective', 'findChainUpTo', 'findScheduled', 'findSiteOverrides']) {
      const body = reads.slice(reads.indexOf(`${name}:`)).split('\n\n')[0] ?? '';
      expect(body, name).toMatch(/\.\.\.live/);
    }
  });
});
