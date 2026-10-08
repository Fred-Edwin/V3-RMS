import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const repo = vi.hoisted(() => ({ findSite: vi.fn(), findSiteByCode: vi.fn(), setSiteCode: vi.fn() }));
vi.mock('./requisitions-repository', () => ({ requisitionsRepository: repo }));

import { AppError } from '../../../utils/errors';
import { branchCodeInputSchema, branchCodeService } from './requisitions-branch-code';

type Actor = Parameters<typeof branchCodeService.set>[0];
const admin: Actor = { id: 'a1', role: 'SYSTEM_ADMIN', siteId: null };
const BRANCH = 'b0000000-0000-4000-8000-000000000001';
const codeOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (e) {
    if (e instanceof AppError) return e.code;
    throw e;
  }
  return 'NO_ERROR';
};

beforeEach(() => {
  vi.resetAllMocks();
  repo.findSite.mockResolvedValue({ id: BRANCH, name: 'Nyeri Town', code: 'NYR', type: 'BRANCH' });
  repo.findSiteByCode.mockResolvedValue(null);
  repo.setSiteCode.mockImplementation(async (id: string, code: string) => ({ id, name: 'Nyeri Town', code }));
});

describe('the branch code correction', () => {
  it('only the System Admin; every other role, including the Branch Manager and the Director, is refused', async () => {
    for (const role of ['MANAGER', 'DIRECTOR', 'STORE_MANAGER', 'ACCOUNTANT', 'STORE_ATTENDANT', 'CHEF'] as const) {
      expect(await codeOf(branchCodeService.set({ id: 'x', role, siteId: BRANCH }, BRANCH, { code: 'ABC' }))).toBe('AUTHORIZATION_ERROR');
    }
    expect(repo.setSiteCode).not.toHaveBeenCalled();
  });

  it('sets the code and returns the branch', async () => {
    expect(await branchCodeService.set(admin, BRANCH, { code: 'NYT' })).toEqual({ id: BRANCH, name: 'Nyeri Town', code: 'NYT' });
    expect(repo.setSiteCode).toHaveBeenCalledWith(BRANCH, 'NYT');
  });

  it('setting the code a branch already has changes nothing', async () => {
    await branchCodeService.set(admin, BRANCH, { code: 'NYR' });
    expect(repo.setSiteCode).not.toHaveBeenCalled();
  });

  it('a code another branch holds is refused (409 BRANCH_CODE_TAKEN), also when the unique index decides a race', async () => {
    repo.findSiteByCode.mockResolvedValue({ id: 'other' });
    expect(await codeOf(branchCodeService.set(admin, BRANCH, { code: 'KNG' }))).toBe('BRANCH_CODE_TAKEN');
    repo.findSiteByCode.mockResolvedValue(null);
    repo.setSiteCode.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }));
    expect(await codeOf(branchCodeService.set(admin, BRANCH, { code: 'KNG' }))).toBe('BRANCH_CODE_TAKEN');
  });

  it('the Central Store and an unknown id are not branches', async () => {
    repo.findSite.mockResolvedValue({ id: 'hub', name: 'Central Store', code: null, type: 'CENTRAL_STORE' });
    expect(await codeOf(branchCodeService.set(admin, 'hub', { code: 'HUB' }))).toBe('NOT_FOUND');
    repo.findSite.mockResolvedValue(null);
    expect(await codeOf(branchCodeService.set(admin, BRANCH, { code: 'ABC' }))).toBe('NOT_FOUND');
  });

  it('a code is three letters, upper-cased', () => {
    expect(branchCodeInputSchema.parse({ code: ' kng ' })).toEqual({ code: 'KNG' });
    for (const bad of ['KN', 'KNGX', 'K1G', '', 'K G']) expect(branchCodeInputSchema.safeParse({ code: bad }).success).toBe(false);
    expect(branchCodeInputSchema.safeParse({ code: 'KNG', extra: 1 }).success).toBe(false);
  });
});
