/**
 * Branch waste service: BW1 to BW7 of docs/features/inventory/branch-waste-contract.md (base `/inventory/branch-waste`), shared by the
 * phone screens (`waste/branch/`) and the desktop screens (`waste/branch-desk/`). Every call goes through `callApi`, the one HTTP seam.
 */
import { makeCallApi, queryString } from '../../../_shared/services/scw-call';
import type {
  AllBranchesWasteQuery,
  BranchWasteDetail,
  BranchWasteEntry,
  BranchWasteItems,
  BranchWasteList,
  BranchWasteListQuery,
  LogBranchWasteInput,
  LogBranchWasteResult,
  MyBranchWasteList,
  MyBranchWasteQuery,
  ReverseBranchWasteInput,
} from '../types/waste-contract';

const BASE = '/inventory/branch-waste';
const callApi = makeCallApi(BASE);

export const branchWasteApi = {
  /** BW1 */
  items: (query: { search?: string; limit?: number } = {}, signal?: AbortSignal) => callApi<BranchWasteItems>('GET', `/items${queryString(query)}`, undefined, signal),
  /** BW2. A repeated idempotency key returns the same batch with `replayed: true`. */
  log: (input: LogBranchWasteInput) => callApi<LogBranchWasteResult>('POST', '', input),
  /** BW3: the caller's whole department, newest first. */
  mine: (query: MyBranchWasteQuery = {}, signal?: AbortSignal) => callApi<MyBranchWasteList>('GET', `/mine${queryString(query)}`, undefined, signal),
  /** BW4: the caller's own branch (Branch Manager). Four figures, rows, the Department filter's options. */
  branch: (query: BranchWasteListQuery = {}, signal?: AbortSignal) => callApi<BranchWasteList>('GET', `/branch${queryString(query)}`, undefined, signal),
  /** BW5: any branch, read only, with a Branch column; `branchId` absent means all branches. */
  branches: (query: AllBranchesWasteQuery = {}, signal?: AbortSignal) => callApi<BranchWasteList>('GET', `/branches${queryString(query)}`, undefined, signal),
  /** BW6: one entry, with its ledger rows for a caller who may see stock. */
  detail: (id: string, signal?: AbortSignal) => callApi<BranchWasteDetail>('GET', `/${id}`, undefined, signal),
  /** BW7. No PIN. The original stays; a linked reversal is added. */
  reverse: (id: string, input: ReverseBranchWasteInput) => callApi<BranchWasteEntry>('POST', `/${id}/reverse`, input),
};
