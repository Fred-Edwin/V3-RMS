'use client';

import { usePermissions } from '../../../_shared/hooks/use-permissions';

export type BranchWasteView = 'branch' | 'all' | 'none';

/**
 * Who sees which Branch waste screen (contract §3), from the server's table only, never a role name: `branch_waste.read` is W6 (the Branch
 * Manager's own branch, with Reverse), `branch_waste.read_any_branch` is W8 (read only, a Branch column). A holder of both (the System
 * Admin) gets W8. Money (the Value column and the four figures) needs `catalog.see_costs`.
 */
export function useBranchWasteAccess(): { ready: boolean; failed: boolean; view: BranchWasteView; seesMoney: boolean } {
  const { can, ready, failed } = usePermissions();
  const view: BranchWasteView = can('branch_waste.read_any_branch') ? 'all' : can('branch_waste.read') ? 'branch' : 'none';
  return { ready, failed, view, seesMoney: can('catalog.see_costs') };
}
