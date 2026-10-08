/**
 * The Department Head's phone calls (contract R3, R7, R8, R9, R11 to R15, R21), typed with the frozen mirror. Components never
 * call `fetch` or `apiClient`; they use these through their hooks. While back end B is unbuilt the calls can be answered by the
 * in-memory mock (`NEXT_PUBLIC_REQUISITIONS_MOCK=1`), which follows the same fixtures; at integration the flag is simply left off.
 */
import type {
  AddAdditionInput,
  AddAdditionResult,
  HistoryMine,
  HistoryMineQuery,
  Home,
  RecallSectionResult,
  RequisitionFile,
  SaveLinesInput,
  SectionDetail,
  SectionEdit,
  SendSectionResult,
  SetUrgentInput,
  SetUrgentResult,
  StartRequisitionInput,
  StartRequisitionResult,
} from '../_shared/types/requisitions-contract';
import { callRequisitions, queryString } from './requisitions-call';
import { mockRequisitionsApi } from './requisitions-mock';

export interface RequisitionsPhoneApi {
  /** R7 */
  home: () => Promise<Home>;
  /** R3 */
  file: (id: string) => Promise<RequisitionFile>;
  /** R8 */
  sectionEdit: (id: string, departmentId: string) => Promise<SectionEdit>;
  /** R9 */
  historyMine: (query: HistoryMineQuery) => Promise<HistoryMine>;
  /** R11. The key is in the body. */
  start: (input: StartRequisitionInput) => Promise<StartRequisitionResult>;
  /** R12. Replaces the whole draft. */
  saveLines: (id: string, departmentId: string, input: SaveLinesInput) => Promise<SectionDetail>;
  /** R13. PIN-signed: takes the Idempotency-Key header. */
  send: (id: string, departmentId: string, pin: string, idempotencyKey: string) => Promise<SendSectionResult>;
  /** R14 */
  recall: (id: string, departmentId: string) => Promise<RecallSectionResult>;
  /** R15 */
  setUrgent: (id: string, input: SetUrgentInput) => Promise<SetUrgentResult>;
  /** R21. PIN-signed: takes the Idempotency-Key header. */
  addAddition: (id: string, input: Omit<AddAdditionInput, 'pin'> & { pin: string }, idempotencyKey: string) => Promise<AddAdditionResult>;
}

const realApi: RequisitionsPhoneApi = {
  home: () => callRequisitions<Home>('GET', '/home'),
  file: (id) => callRequisitions<RequisitionFile>('GET', `/${id}`),
  sectionEdit: (id, departmentId) => callRequisitions<SectionEdit>('GET', `/${id}/sections/${departmentId}`),
  historyMine: (query) => callRequisitions<HistoryMine>('GET', `/history/mine${queryString(query)}`),
  start: (input) => callRequisitions<StartRequisitionResult>('POST', '', input),
  saveLines: (id, departmentId, input) => callRequisitions<SectionDetail>('PUT', `/${id}/sections/${departmentId}/lines`, input),
  send: (id, departmentId, pin, idempotencyKey) => callRequisitions<SendSectionResult>('POST', `/${id}/sections/${departmentId}/send`, { pin }, idempotencyKey),
  recall: (id, departmentId) => callRequisitions<RecallSectionResult>('POST', `/${id}/sections/${departmentId}/recall`),
  setUrgent: (id, input) => callRequisitions<SetUrgentResult>('PUT', `/${id}/urgent`, input),
  addAddition: (id, input, idempotencyKey) => callRequisitions<AddAdditionResult>('POST', `/${id}/additions`, input, idempotencyKey),
};

export const requisitionsApi: RequisitionsPhoneApi = process.env.NEXT_PUBLIC_REQUISITIONS_MOCK === '1' ? mockRequisitionsApi : realApi;
