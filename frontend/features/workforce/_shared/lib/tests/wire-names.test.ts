import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The API still calls a branch an "organization" on the wire (backend `shared/utils/wire-names.ts`). Three Segment 3 screens once read
 * `site` names that the API never sends, so a header said "undefined" and a head saw "You do not record casual pay". These checks keep
 * the response types on the wire names.
 */
const read = (path: string): string => readFileSync(resolve(__dirname, '../../../', path), 'utf8');

describe('response types use the wire names for a branch', () => {
  it('the permissions payload carries organizationId', () => {
    const source = read('_shared/lib/data/capabilities.ts');
    expect(source).toMatch(/organizationId:\s*string \| null/);
    expect(source).not.toMatch(/\bsiteId:\s*string \| null/);
  });

  it('the payslip detail summary carries organization', () => {
    expect(read('payslips/_shared/types/payslip-types.ts')).toMatch(/employeeSummary:\s*\{[^}]*organization:\s*string/);
  });

  it('the casual sheet and sheet cards carry organizationId and organizationName', () => {
    const source = read('casual/_shared/types/casual-types.ts');
    expect(source).toMatch(/organizationId:\s*string/);
    expect(source.match(/organizationName:\s*string/g)).toHaveLength(2);
    expect(source).not.toMatch(/\bsiteName\b/);
  });

  it('the Leave balances, requests and away shapes carry organization, organizations, organizationName and organizationId', () => {
    const source = read('leave/_shared/types/leave-types.ts');
    expect(source).toMatch(/organizations:\s*\{ id: string/);
    expect(source).toMatch(/organizationName:\s*string/);
    expect(source).toMatch(/organizationId:\s*string/);
    expect(source.match(/organization:\s*string/g)).toHaveLength(3);
    expect(source).not.toMatch(/\bsites?:\s|\bsiteName\b|\bsiteId:\s*string;/);
  });
});
