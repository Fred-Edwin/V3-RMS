/**
 * Discrepancies (Q1 to Q5) and the deliveries calls the Branch Manager's drawer makes (V2 to V6). Real HTTP when back end D is
 * live (`MOCK_BRANCH_SIDE` false), the desktop lane's mock until then. Signing writes carry their key in the body.
 */
import { apiClient } from '@/lib/apiClient';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/types/api';
import { queryString } from '../../_shared/services/scw-call';
import type {
  DiscrepancyFile,
  Finding,
  FindingPreview,
  ListDiscrepancies,
  ListDiscrepanciesQuery,
  RecordFindingInput,
  RecordFindingResult,
  ReverseFindingInput,
  ReverseFindingResult,
} from '../../discrepancies/_shared/types/discrepancies-contract';
import type { CheckCountResult, ConfirmDeliveryInput, ConfirmDeliveryResult, ConfirmPreview, CountLine, CountView, DeletePhotoResult, SaveCountInput, SetReasonInput, UploadPhotoResult } from '../../deliveries/_shared/types/deliveries-contract';
import { mockDeliveries, mockDiscrepancies } from './dispatch-mock-desktop';
import { MOCK_BRANCH_SIDE } from './mock-mode';

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const DISC = '/inventory/discrepancies';
const DELIV = '/inventory/deliveries';

export const discrepanciesApi = {
  /** Q1 */
  list: (query: ListDiscrepanciesQuery = {}): Promise<ListDiscrepancies> => (MOCK_BRANCH_SIDE ? mockDiscrepancies.list(query) : apiClient.get<ListDiscrepancies>(`${DISC}${queryString(query)}`, token())),
  /** Q2 */
  file: (id: string): Promise<DiscrepancyFile> => (MOCK_BRANCH_SIDE ? mockDiscrepancies.file(id) : apiClient.get<DiscrepancyFile>(`${DISC}/${id}`, token())),
  /** Q3 */
  preview: (id: string, finding: Finding): Promise<FindingPreview> => (MOCK_BRANCH_SIDE ? mockDiscrepancies.preview(id, finding) : apiClient.get<FindingPreview>(`${DISC}/${id}/finding-preview${queryString({ finding })}`, token())),
  /** Q4 */
  record: (id: string, input: RecordFindingInput): Promise<RecordFindingResult> => (MOCK_BRANCH_SIDE ? mockDiscrepancies.record(id, input) : apiClient.post<RecordFindingResult>(`${DISC}/${id}/findings`, input, token())),
  /** Q5 */
  reverse: (id: string, input: ReverseFindingInput): Promise<ReverseFindingResult> => (MOCK_BRANCH_SIDE ? mockDiscrepancies.reverse(id, input) : apiClient.post<ReverseFindingResult>(`${DISC}/${id}/reverse`, input, token())),
};

export const deliveriesDrawerApi = {
  /** V2 */
  count: (id: string): Promise<CountView> => (MOCK_BRANCH_SIDE ? mockDeliveries.count(id) : apiClient.get<CountView>(`${DELIV}/${id}/count`, token())),
  /** V3 */
  save: (id: string, input: SaveCountInput): Promise<CountView> => (MOCK_BRANCH_SIDE ? mockDeliveries.save(id, input) : apiClient.put<CountView>(`${DELIV}/${id}/count`, input, token())),
  check: (id: string): Promise<CheckCountResult> => (MOCK_BRANCH_SIDE ? mockDeliveries.check(id) : apiClient.post<CheckCountResult>(`${DELIV}/${id}/check`, {}, token())),
  /** V4 */
  reason: (id: string, lineId: string, input: SetReasonInput): Promise<CountLine> => (MOCK_BRANCH_SIDE ? mockDeliveries.reason(id, lineId, input) : apiClient.put<CountLine>(`${DELIV}/${id}/lines/${lineId}/reason`, input, token())),
  /** V4: multipart upload (a `lineId` field and one `file` part). The mock keeps a local preview. */
  uploadPhoto: async (id: string, lineId: string, file: File): Promise<UploadPhotoResult> => {
    if (MOCK_BRANCH_SIDE) return mockDeliveries.uploadPhoto(id, lineId, file);
    const form = new FormData();
    form.append('lineId', lineId);
    form.append('file', file);
    const accessToken = token();
    const response = await fetch(`${env.apiUrl}${DELIV}/${id}/photos`, { method: 'POST', body: form, credentials: 'include', headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
    const payload = (await response.json()) as { data?: UploadPhotoResult; error?: { message?: string; code?: string } };
    if (!response.ok || !payload.data) throw new ApiError(payload.error?.message ?? 'Request failed', response.status, payload.error?.code ?? 'UNKNOWN_ERROR');
    return payload.data;
  },
  deletePhoto: (id: string, photoId: string): Promise<DeletePhotoResult> => (MOCK_BRANCH_SIDE ? mockDeliveries.deletePhoto(id, photoId) : apiClient.delete<DeletePhotoResult>(`${DELIV}/${id}/photos/${photoId}`, token())),
  /** V5 */
  preview: (id: string): Promise<ConfirmPreview> => (MOCK_BRANCH_SIDE ? mockDeliveries.preview(id) : apiClient.get<ConfirmPreview>(`${DELIV}/${id}/confirm-preview`, token())),
  /** V6 */
  confirm: (id: string, input: ConfirmDeliveryInput): Promise<ConfirmDeliveryResult> => (MOCK_BRANCH_SIDE ? mockDeliveries.confirm(id, input) : apiClient.post<ConfirmDeliveryResult>(`${DELIV}/${id}/confirm`, input, token())),
};
