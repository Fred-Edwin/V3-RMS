/**
 * Requisitions' one HTTP service for the desktop screens (contract R1 to R22). Reads and writes go through `apiClient`; signing
 * writes carry an `Idempotency-Key` header (R11 carries its key in the body).
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

const BASE = '/inventory/requisitions';
const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const signed = (key: string): Record<string, string> => ({ [IDEMPOTENCY_HEADER]: key });

export const requisitionsApi = {
  /** R1 */
  list: (query: ListRequisitionsQuery = {}): Promise<ListRequisitions> => apiClient.get<ListRequisitions>(`${BASE}${queryString(query)}`, token()),
  /** R2 */
  badges: (): Promise<Badges> => apiClient.get<Badges>(`${BASE}/badges`, token()),
  /** R3 */
  file: (id: string): Promise<RequisitionFile> => apiClient.get<RequisitionFile>(`${BASE}/${id}`, token()),
  /** R4 */
  activity: (id: string): Promise<Activity> => apiClient.get<Activity>(`${BASE}/${id}/activity`, token()),
  /** R5 */
  documents: (id: string): Promise<Documents> => apiClient.get<Documents>(`${BASE}/${id}/documents`, token()),
  /** R6 */
  print: (id: string): Promise<Print> => apiClient.get<Print>(`${BASE}/${id}/print`, token()),
  /** R8 */
  section: (id: string, departmentId: string): Promise<SectionEdit> => apiClient.get<SectionEdit>(`${BASE}/${id}/sections/${departmentId}`, token()),
  /** R10 */
  approveSummary: (id: string): Promise<ApproveSummary> => apiClient.get<ApproveSummary>(`${BASE}/${id}/approve-summary`, token()),

  /** R11 */
  start: (input: StartRequisitionInput): Promise<StartRequisitionResult> => apiClient.post<StartRequisitionResult>(BASE, input, token()),
  /** R12 (the response is the updated section) */
  saveLines: (id: string, departmentId: string, input: SaveLinesInput): Promise<SectionDetail> =>
    apiClient.put<SectionDetail>(`${BASE}/${id}/sections/${departmentId}/lines`, input, token()),
  /** R13 (on behalf: the Branch Manager's own PIN) */
  send: (id: string, departmentId: string, input: SendSectionInput, key: string): Promise<SendSectionResult> =>
    apiClient.post<SendSectionResult>(`${BASE}/${id}/sections/${departmentId}/send`, input, token(), signed(key)),
  /** R15 */
  setUrgent: (id: string, input: SetUrgentInput): Promise<SetUrgentResult> => apiClient.put<SetUrgentResult>(`${BASE}/${id}/urgent`, input, token()),
  /** R16 */
  changeQuantity: (id: string, lineId: string, input: ChangeQuantityInput): Promise<ChangeQuantityResult> =>
    apiClient.patch<ChangeQuantityResult>(`${BASE}/${id}/lines/${lineId}`, input, token()),
  /** R17 */
  nudge: (id: string, departmentId: string): Promise<NudgeResult> => apiClient.post<NudgeResult>(`${BASE}/${id}/sections/${departmentId}/nudge`, {}, token()),
  /** R18 (Amendment 2): one call, one transaction */
  skip: (id: string, input: SkipSectionsInput): Promise<SkipSectionResult> => apiClient.post<SkipSectionResult>(`${BASE}/${id}/skip`, input, token()),
  /** R19 */
  approve: (id: string, input: ApproveInput, key: string): Promise<ApproveResult> => apiClient.post<ApproveResult>(`${BASE}/${id}/approve`, input, token(), signed(key)),
  /** R20 */
  cancel: (id: string, input: CancelInput, key: string): Promise<CancelResult> => apiClient.post<CancelResult>(`${BASE}/${id}/cancel`, input, token(), signed(key)),
  /** R21 (a head's; the phone screens call it through their own service) */
  addAddition: (id: string, input: AddAdditionInput, key: string): Promise<AddAdditionResult> =>
    apiClient.post<AddAdditionResult>(`${BASE}/${id}/additions`, input, token(), signed(key)),
  /** R22 */
  approveAddition: (id: string, additionId: string, input: ApproveAdditionInput, key: string): Promise<ApproveAdditionResult> =>
    apiClient.post<ApproveAdditionResult>(`${BASE}/${id}/additions/${additionId}/approve`, input, token(), signed(key)),
};
