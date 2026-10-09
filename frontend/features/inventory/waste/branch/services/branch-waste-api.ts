/**
 * Branch waste's phone service (contract BW1 to BW3 and BW7, base `/inventory/branch-waste`). Every call goes through `callApi`.
 */
import { makeCallApi, queryString } from '../../../_shared/services/scw-call';
import type {
  BranchWasteEntry,
  BranchWasteItems,
  LogBranchWasteInput,
  LogBranchWasteResult,
  MyBranchWasteList,
  MyBranchWasteQuery,
  ReverseBranchWasteInput,
} from '../../_shared/types/waste-contract';

const BASE = '/inventory/branch-waste';
const callApi = makeCallApi(BASE);

export const branchWasteApi = {
  /** BW1 */
  items: (query: { search?: string; limit?: number } = {}, signal?: AbortSignal) => callApi<BranchWasteItems>('GET', `/items${queryString(query)}`, undefined, signal),
  /** BW2. A repeated idempotency key returns the same batch with `replayed: true`. */
  log: (input: LogBranchWasteInput) => callApi<LogBranchWasteResult>('POST', '', input),
  /** BW3: the caller's whole department, newest first. */
  mine: (query: MyBranchWasteQuery = {}, signal?: AbortSignal) => callApi<MyBranchWasteList>('GET', `/mine${queryString(query)}`, undefined, signal),
  /** BW7. No PIN. */
  reverse: (id: string, input: ReverseBranchWasteInput) => callApi<BranchWasteEntry>('POST', `/${id}/reverse`, input),
};
