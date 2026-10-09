/**
 * Branch waste, desktop screens: BW4 to BW7 of docs/features/inventory/branch-waste-contract.md (base `/inventory/branch-waste`).
 * Every call goes through `callApi`, the one HTTP seam. The phone screens (BW1 to BW3) have their own service in `waste/branch/`.
 */
import { makeCallApi, queryString } from '../../../_shared/services/scw-call';
import type {
  AllBranchesWasteQuery,
  BranchWasteDetail,
  BranchWasteEntry,
  BranchWasteList,
  BranchWasteListQuery,
  ReverseBranchWasteInput,
} from '../../_shared/types/waste-contract';

const BASE = '/inventory/branch-waste';
const callApi = makeCallApi(BASE);

export const branchWasteDeskApi = {
  /** BW4: the caller's own branch (Branch Manager). Four figures, rows, the Department filter's options. */
  branch: (query: BranchWasteListQuery = {}, signal?: AbortSignal) => callApi<BranchWasteList>('GET', `/branch${queryString(query)}`, undefined, signal),
  /** BW5: any branch, read only, with a Branch column; `branchId` absent means all branches. */
  branches: (query: AllBranchesWasteQuery = {}, signal?: AbortSignal) => callApi<BranchWasteList>('GET', `/branches${queryString(query)}`, undefined, signal),
  /** BW6: one entry, with its ledger rows for a caller who may see stock. */
  detail: (id: string, signal?: AbortSignal) => callApi<BranchWasteDetail>('GET', `/${id}`, undefined, signal),
  /** BW7: no PIN. The original stays; a linked reversal is added. */
  reverse: (id: string, input: ReverseBranchWasteInput) => callApi<BranchWasteEntry>('POST', `/${id}/reverse`, input),
};
