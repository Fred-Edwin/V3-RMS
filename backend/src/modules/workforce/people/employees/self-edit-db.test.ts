/**
 * The person edits their own numbers and bank at any time (owner decision, 22 Oct 2026): it saves at once, HR does not re-check,
 * a bank or account change tells the Accountant. Runs only on a `_lane` database; it puts the person's values back afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const url = process.env['DATABASE_URL'] ?? '';
const enabled = /_lane\d*(\?|$)/.test(url) || /_lane\d*_/.test(url);

describe.skipIf(!enabled)('A person edits their own numbers and bank', () => {
  type Prisma = typeof import('../../../../config/database').prisma;
  let prisma: Prisma;
  let service: typeof import('./employees-service').employeesService;
  let subject: import('../../_shared/workforce-access').AccessSubject;
  let employeeId = '';
  let before: { nationalId: string | null; kraPin: string | null; statutoryVerifiedAt: Date | null; bankName: string | null; accountNumber: string | null; hadProfile: boolean };

  beforeAll(async () => {
    ({ prisma } = await import('../../../../config/database'));
    ({ employeesService: service } = await import('./employees-service'));
    const row = await prisma.employee.findFirstOrThrow({
      where: { userId: { not: null }, status: 'ACTIVE', user: { role: 'BARISTA' } },
      select: { id: true, userId: true, nationalId: true, kraPin: true, statutoryVerifiedAt: true, user: { select: { role: true, siteId: true } }, payProfile: { select: { bankName: true, accountNumber: true } } },
    });
    employeeId = row.id;
    subject = { id: row.userId!, role: row.user!.role, siteId: row.user!.siteId, headOfDepartmentIds: [] };
    before = { nationalId: row.nationalId, kraPin: row.kraPin, statutoryVerifiedAt: row.statutoryVerifiedAt, bankName: row.payProfile?.bankName ?? null, accountNumber: row.payProfile?.accountNumber ?? null, hadProfile: !!row.payProfile };
    // A file HR has already verified used to close these fields to the person.
    await prisma.employee.update({ where: { id: employeeId }, data: { statutoryVerifiedAt: new Date() } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.employee.update({ where: { id: employeeId }, data: { nationalId: before.nationalId, kraPin: before.kraPin, statutoryVerifiedAt: before.statutoryVerifiedAt } });
    if (before.hadProfile) await prisma.payProfile.update({ where: { employeeId }, data: { bankName: before.bankName, accountNumber: before.accountNumber } });
    await prisma.$disconnect();
  });

  it('saves a number on a file HR already verified, and does not reset the check', async () => {
    await service.patchMe(subject, { kraPin: 'A123456789Z' });
    const row = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { kraPin: true, statutoryVerifiedAt: true } });
    expect(row.kraPin).toBe('A123456789Z');
    expect(row.statutoryVerifiedAt).not.toBeNull();
  });

  it('saves the bank and account at once and writes an audit entry without the number', async () => {
    await service.patchMe(subject, { bankName: 'Equity Bank', accountNumber: '0123456789012' });
    const profile = await prisma.payProfile.findUniqueOrThrow({ where: { employeeId }, select: { bankName: true, accountNumber: true } });
    expect(profile).toEqual({ bankName: 'Equity Bank', accountNumber: '0123456789012' });
    const entry = await prisma.auditEntry.findFirstOrThrow({ where: { subjectId: employeeId, action: 'people.self_updated' }, orderBy: { occurredAt: 'desc' } });
    expect(JSON.stringify(entry, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('0123456789012');
  });
});
