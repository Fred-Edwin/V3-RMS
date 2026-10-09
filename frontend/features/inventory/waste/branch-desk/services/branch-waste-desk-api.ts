/**
 * Branch waste, desktop screens: BW4 to BW7 of docs/features/inventory/branch-waste-contract.md (base `/inventory/branch-waste`).
 * Every call goes through `callApi` (the real client) unless `BRANCH_WASTE_MOCK` is on, which serves the contract-shaped fixtures in
 * `lib/mock-data.ts` instead. The mock is ON until feat/block3-be is merged: flip the default below (or set
 * `NEXT_PUBLIC_BRANCH_WASTE_MOCK=off`) and nothing else changes. The phone screens (BW1 to BW3) have their own service in `waste/branch/`.
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
import { mockBranchWaste } from '../lib/mock-data';

const BASE = '/inventory/branch-waste';
const callApi = makeCallApi(BASE);

/** True while the back end (Block 3, feat/block3-be) has not landed. */
export const BRANCH_WASTE_MOCK = process.env.NEXT_PUBLIC_BRANCH_WASTE_MOCK !== 'off';

export const branchWasteDeskApi = {
  /** BW4: the caller's own branch (Branch Manager). Four figures, rows, the Department filter's options. */
  branch: (query: BranchWasteListQuery = {}, signal?: AbortSignal): Promise<BranchWasteList> =>
    BRANCH_WASTE_MOCK ? mockBranchWaste.branch(query) : callApi<BranchWasteList>('GET', `/branch${queryString(query)}`, undefined, signal),
  /** BW5: any branch, read only, with a Branch column; `branchId` absent means all branches. */
  branches: (query: AllBranchesWasteQuery = {}, signal?: AbortSignal): Promise<BranchWasteList> =>
    BRANCH_WASTE_MOCK ? mockBranchWaste.branches(query) : callApi<BranchWasteList>('GET', `/branches${queryString(query)}`, undefined, signal),
  /** BW6: one entry, with its ledger rows for a caller who may see stock. */
  detail: (id: string, signal?: AbortSignal): Promise<BranchWasteDetail> =>
    BRANCH_WASTE_MOCK ? mockBranchWaste.detail(id) : callApi<BranchWasteDetail>('GET', `/${id}`, undefined, signal),
  /** BW7: no PIN. The original stays; a linked reversal is added. */
  reverse: (id: string, input: ReverseBranchWasteInput): Promise<BranchWasteEntry> =>
    BRANCH_WASTE_MOCK ? mockBranchWaste.reverse(id, input) : callApi<BranchWasteEntry>('POST', `/${id}/reverse`, input),
};
