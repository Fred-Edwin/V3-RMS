import { describe, expect, it, vi } from 'vitest';
import type { UserRole } from '@prisma/client';
import type { AccessSubject } from '../../_shared/workforce-access';
import type { NeedsYouContext } from '../needs-you-types';
import { attentionRows } from './attention-source';

const reads = vi.hoisted(() => ({
  onboarding: vi.fn(async () => []),
  probationEnding: vi.fn(async () => []),
  departmentsWithoutHead: vi.fn(async () => []),
}));
vi.mock('./attention-repository', () => ({ attentionReads: reads }));

const who = (role: UserRole): AccessSubject => ({ id: 'u1', role, siteId: role === 'SYSTEM_ADMIN' ? null : 's1' });
const ctx = { companyId: 'c1', now: new Date('2026-10-22T09:00:00Z') } as unknown as NeedsYouContext;

describe('HR housekeeping rows', () => {
  it('are not made for the System Admin, who has no People screens to open them in', async () => {
    expect(await attentionRows(who('SYSTEM_ADMIN'), ctx)).toEqual([]);
    expect(reads.departmentsWithoutHead).not.toHaveBeenCalled();
  });

  it('are still read for HR', async () => {
    await attentionRows(who('HR_MANAGER'), ctx);
    expect(reads.departmentsWithoutHead).toHaveBeenCalledTimes(1);
  });
});
