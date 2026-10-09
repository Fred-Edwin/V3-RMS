/**
 * Branch waste's phone service (contract BW1 to BW3 and BW7, base `/inventory/branch-waste`). Every call goes through `callApi`.
 * While the back end (`feat/block3-be`) is unmerged, `NEXT_PUBLIC_BRANCH_WASTE_MOCK=true` answers from in-memory data built
 * from the contract fixtures (`branch-waste-mock.ts`, loaded only when the flag is on). The flag is OFF by default; delete it and
 * the mock file once the real API is the only path.
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

export interface BranchWasteApi {
  /** BW1 */
  items: (query?: { search?: string; limit?: number }, signal?: AbortSignal) => Promise<BranchWasteItems>;
  /** BW2. A repeated idempotency key returns the same batch with `replayed: true`. */
  log: (input: LogBranchWasteInput) => Promise<LogBranchWasteResult>;
  /** BW3: the caller's whole department, newest first. */
  mine: (query?: MyBranchWasteQuery, signal?: AbortSignal) => Promise<MyBranchWasteList>;
  /** BW7. No PIN. */
  reverse: (id: string, input: ReverseBranchWasteInput) => Promise<BranchWasteEntry>;
}

const realApi: BranchWasteApi = {
  items: (query = {}, signal) => callApi<BranchWasteItems>('GET', `/items${queryString(query)}`, undefined, signal),
  log: (input) => callApi<LogBranchWasteResult>('POST', '', input),
  mine: (query = {}, signal) => callApi<MyBranchWasteList>('GET', `/mine${queryString(query)}`, undefined, signal),
  reverse: (id, input) => callApi<BranchWasteEntry>('POST', `/${id}/reverse`, input),
};

export const BRANCH_WASTE_MOCK = process.env.NEXT_PUBLIC_BRANCH_WASTE_MOCK === 'true';

/** Loads the in-memory twin once, on first use. Only reached when the flag is on. */
let mock: Promise<BranchWasteApi> | null = null;
const mockApi = (): Promise<BranchWasteApi> => (mock ??= import('./branch-waste-mock').then((m) => m.mockBranchWasteApi));

export const branchWasteApi: BranchWasteApi = BRANCH_WASTE_MOCK
  ? {
      items: async (q, s) => (await mockApi()).items(q, s),
      log: async (i) => (await mockApi()).log(i),
      mine: async (q, s) => (await mockApi()).mine(q, s),
      reverse: async (id, i) => (await mockApi()).reverse(id, i),
    }
  : realApi;
