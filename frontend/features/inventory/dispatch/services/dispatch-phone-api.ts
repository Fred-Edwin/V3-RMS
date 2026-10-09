/**
 * The Store Attendant's phone calls (contract P1 to P9, back end C: always the real API), typed with the frozen mirror.
 * Components never call `fetch` or `apiClient`; they use these through their hooks.
 */
import { ApiError } from '@/types/api';
import { makeCallApi, queryString } from '../../_shared/services/scw-call';
import type {
  DispatchFile,
  DispatchMine,
  DispatchMineQuery,
  PackDepartment,
  Queue,
  Review,
  SavePackLinesInput,
  SignDispatchInput,
  SignDispatchResult,
} from '../_shared/types/dispatch-contract';

const call = makeCallApi('/inventory/dispatch');

/**
 * The first look at a department builds its dispatch row on the server. Two reads in the same instant (a double tap, a second
 * device) can collide there and one gets a 500 (reported to back end C). A read is safe to repeat, so a 500 is tried once more.
 */
async function readWithOneRetry<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (err) {
    if (err instanceof ApiError && err.statusCode >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return read();
    }
    throw err;
  }
}

export interface DispatchPhoneApi {
  /** P1 */
  queue: () => Promise<Queue>;
  /** P2 */
  department: (requisitionId: string, departmentId: string) => Promise<PackDepartment>;
  /** P3. Last write wins. */
  saveLines: (requisitionId: string, departmentId: string, input: SavePackLinesInput) => Promise<PackDepartment>;
  /** P4 */
  review: (requisitionId: string) => Promise<Review>;
  /** P5. PIN-signed; the idempotency key is in the body. */
  sign: (requisitionId: string, input: SignDispatchInput) => Promise<SignDispatchResult>;
  /** P6 */
  file: (id: string) => Promise<DispatchFile>;
  /** P9 */
  mine: (query: DispatchMineQuery) => Promise<DispatchMine>;
}

export const dispatchPhoneApi: DispatchPhoneApi = {
  queue: () => call<Queue>('GET', '/queue'),
  department: (requisitionId, departmentId) => readWithOneRetry(() => call<PackDepartment>('GET', `/pack/${requisitionId}/departments/${departmentId}`)),
  saveLines: (requisitionId, departmentId, input) => call<PackDepartment>('PUT', `/pack/${requisitionId}/departments/${departmentId}/lines`, input),
  review: (requisitionId) => call<Review>('GET', `/pack/${requisitionId}/review`),
  sign: (requisitionId, input) => call<SignDispatchResult>('POST', `/pack/${requisitionId}/sign`, input),
  file: (id) => call<DispatchFile>('GET', `/${id}`),
  mine: (query) => call<DispatchMine>('GET', `/mine${queryString(query)}`),
};
