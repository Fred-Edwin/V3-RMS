/**
 * Requisitions' one HTTP service (contract R1 to R22). Reads and writes go through `apiClient`; signing writes carry an
 * `Idempotency-Key` header (R11 carries its key in the body). While back end B is unbuilt, `NEXT_PUBLIC_REQUISITIONS_MOCK=1`
 * answers from the contract fixtures instead (`requisitions-mock.ts`); the real API is wired at integration by unsetting it.
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import { queryString } from '../../../_shared/services/scw-call';
import {
  IDEMPOTENCY_HEADER,
  type Activity,
  type AddAdditionInput,
  type AddAdditionResult,
  type ApproveAdditionInput,
  type ApproveAdditionResult,
  type ApproveInput,
  type ApproveResult,
  type ApproveSummary,
  type Badges,
  type CancelInput,
  type CancelResult,
  type ChangeQuantityInput,
  type ChangeQuantityResult,
  type Documents,
  type ListRequisitions,
  type ListRequisitionsQuery,
  type NudgeResult,
  type Print,
  type RequisitionFile,
  type SectionDetail,
  type SectionEdit,
  type SaveLinesInput,
  type SendSectionInput,
  type SendSectionResult,
  type SetUrgentInput,
  type SetUrgentResult,
  type SkipSectionResult,
  type SkipSectionsInput,
  type StartRequisitionInput,
  type StartRequisitionResult,
} from '../types/requisitions-contract';
import { mockRequisitions } from './requisitions-mock';

const BASE = '/inventory/requisitions';
const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const useMock = (): boolean => process.env.NEXT_PUBLIC_REQUISITIONS_MOCK === '1';
const signed = (key: string): Record<string, string> => ({ [IDEMPOTENCY_HEADER]: key });

export const requisitionsApi = {
  /** R1 */
  list: (query: ListRequisitionsQuery = {}): Promise<ListRequisitions> =>
    useMock() ? mockRequisitions.list(query) : apiClient.get<ListRequisitions>(`${BASE}${queryString(query)}`, token()),
  /** R2 */
  badges: (): Promise<Badges> => (useMock() ? mockRequisitions.badges() : apiClient.get<Badges>(`${BASE}/badges`, token())),
  /** R3 */
  file: (id: string): Promise<RequisitionFile> => (useMock() ? mockRequisitions.file(id) : apiClient.get<RequisitionFile>(`${BASE}/${id}`, token())),
  /** R4 */
  activity: (id: string): Promise<Activity> => (useMock() ? mockRequisitions.activity() : apiClient.get<Activity>(`${BASE}/${id}/activity`, token())),
  /** R5 */
  documents: (id: string): Promise<Documents> => (useMock() ? mockRequisitions.documents() : apiClient.get<Documents>(`${BASE}/${id}/documents`, token())),
  /** R6 */
  print: (id: string): Promise<Print> => (useMock() ? mockRequisitions.print() : apiClient.get<Print>(`${BASE}/${id}/print`, token())),
  /** R8 */
  section: (id: string, departmentId: string): Promise<SectionEdit> =>
    useMock() ? mockRequisitions.section() : apiClient.get<SectionEdit>(`${BASE}/${id}/sections/${departmentId}`, token()),
  /** R10 */
  approveSummary: (id: string): Promise<ApproveSummary> =>
    useMock() ? mockRequisitions.approveSummary() : apiClient.get<ApproveSummary>(`${BASE}/${id}/approve-summary`, token()),

  /** R11 */
  start: (input: StartRequisitionInput): Promise<StartRequisitionResult> =>
    useMock() ? mockRequisitions.start() : apiClient.post<StartRequisitionResult>(BASE, input, token()),
  /** R12 (the response is the updated section) */
  saveLines: (id: string, departmentId: string, input: SaveLinesInput): Promise<SectionDetail> =>
    useMock() ? mockRequisitions.saveLines(input) : apiClientPut<SectionDetail>(`${BASE}/${id}/sections/${departmentId}/lines`, input),
  /** R13 (on behalf: the Branch Manager's own PIN) */
  send: (id: string, departmentId: string, input: SendSectionInput, key: string): Promise<SendSectionResult> =>
    useMock() ? mockRequisitions.send() : apiClient.post<SendSectionResult>(`${BASE}/${id}/sections/${departmentId}/send`, input, token(), signed(key)),
  /** R15 */
  setUrgent: (id: string, input: SetUrgentInput): Promise<SetUrgentResult> =>
    useMock() ? mockRequisitions.setUrgent(input) : apiClientPut<SetUrgentResult>(`${BASE}/${id}/urgent`, input),
  /** R16 */
  changeQuantity: (id: string, lineId: string, input: ChangeQuantityInput): Promise<ChangeQuantityResult> =>
    useMock() ? mockRequisitions.changeQuantity() : apiClient.patch<ChangeQuantityResult>(`${BASE}/${id}/lines/${lineId}`, input, token()),
  /** R17 */
  nudge: (id: string, departmentId: string): Promise<NudgeResult> =>
    useMock() ? mockRequisitions.nudge() : apiClient.post<NudgeResult>(`${BASE}/${id}/sections/${departmentId}/nudge`, {}, token()),
  /** R18 (Amendment 2): one call, one transaction */
  skip: (id: string, input: SkipSectionsInput): Promise<SkipSectionResult> =>
    useMock() ? mockRequisitions.skip() : apiClient.post<SkipSectionResult>(`${BASE}/${id}/skip`, input, token()),
  /** R19 */
  approve: (id: string, input: ApproveInput, key: string): Promise<ApproveResult> =>
    useMock() ? mockRequisitions.approve() : apiClient.post<ApproveResult>(`${BASE}/${id}/approve`, input, token(), signed(key)),
  /** R20 */
  cancel: (id: string, input: CancelInput, key: string): Promise<CancelResult> =>
    useMock() ? mockRequisitions.cancel() : apiClient.post<CancelResult>(`${BASE}/${id}/cancel`, input, token(), signed(key)),
  /** R21 (a head's; kept here for the phone session's use) */
  addAddition: (id: string, input: AddAdditionInput, key: string): Promise<AddAdditionResult> =>
    apiClient.post<AddAdditionResult>(`${BASE}/${id}/additions`, input, token(), signed(key)),
  /** R22 */
  approveAddition: (id: string, additionId: string, input: ApproveAdditionInput, key: string): Promise<ApproveAdditionResult> =>
    useMock() ? mockRequisitions.approveAddition() : apiClient.post<ApproveAdditionResult>(`${BASE}/${id}/additions/${additionId}/approve`, input, token(), signed(key)),
};

function apiClientPut<T>(path: string, body: unknown): Promise<T> {
  return apiClient.put<T>(path, body, token());
}
