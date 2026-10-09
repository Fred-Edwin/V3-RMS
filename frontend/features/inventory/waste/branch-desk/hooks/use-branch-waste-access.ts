'use client';

import { usePermissions } from '../../../_shared/hooks/use-permissions';
import { useAuthStore } from '@/store/authStore';
import type { AppRole } from '@/types/auth';
import { BRANCH_WASTE_MOCK } from '../services/branch-waste-desk-api';

export type BranchWasteView = 'branch' | 'all' | 'none';

/**
 * Who sees which Branch waste screen (contract §3): `branch_waste.read` is W6 (the Branch Manager's own branch, with Reverse),
 * `branch_waste.read_any_branch` is W8 (read only, a Branch column). A holder of both (the System Admin) gets W8. Money (the
 * Value column and the four figures) needs `catalog.see_costs`. Real mode reads the server's table only. Mock mode (no table row on a
 * server that has not landed Block 3) derives the same answer from the role, so the screens can be walked before the back end exists.
 */
const MOCK_VIEW: Partial<Record<AppRole, BranchWasteView>> = {
  MANAGER: 'branch',
  DIRECTOR: 'all',
  ACCOUNTANT: 'all',
  STORE_MANAGER: 'all',
  SYSTEM_ADMIN: 'all',
};

export function useBranchWasteAccess(): { ready: boolean; failed: boolean; view: BranchWasteView; seesMoney: boolean } {
  const { can, ready, failed } = usePermissions();
  const role = useAuthStore((s) => s.user?.role ?? null);
  if (BRANCH_WASTE_MOCK) return { ready: role !== null, failed: false, view: (role && MOCK_VIEW[role]) || 'none', seesMoney: true };
  const view: BranchWasteView = can('branch_waste.read_any_branch') ? 'all' : can('branch_waste.read') ? 'branch' : 'none';
  return { ready, failed, view, seesMoney: can('catalog.see_costs') };
}
