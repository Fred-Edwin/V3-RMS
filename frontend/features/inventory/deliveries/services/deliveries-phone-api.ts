/**
 * The department's phone calls (contract V1 to V6, plus the member's read-only delivery file). Back end D has not merged, so these
 * answer from the hand-written mock (`dispatch-mock-phone.ts`) unless `NEXT_PUBLIC_DISPATCH_MOCK=off`. Components never call `fetch`.
 *
 * Contract drift to report: a department member holds no `dispatch.read`, so P6 cannot serve the delivery file (N3). The file call
 * below is the proposed `GET /inventory/deliveries/:id`, which returns the same `DispatchFile` shape (sent figure only after the
 * department has counted).
 */
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';
import { makeCallApi, queryString } from '../../_shared/services/scw-call';
import { apiClient } from '@/lib/apiClient';
import type { DispatchFile } from '../../dispatch/_shared/types/dispatch-contract';
import { MOCK_BRANCH_SIDE } from '../../dispatch/services/mock-mode';
import type {
  CheckCountResult,
  ConfirmDeliveryInput,
  ConfirmDeliveryResult,
  ConfirmPreview,
  CountLine,
  CountView,
  DeletePhotoResult,
  ListDeliveries,
  ListDeliveriesQuery,
  SaveCountInput,
  SetReasonInput,
  UploadPhotoResult,
} from '../_shared/types/deliveries-contract';
import { mockDeliveriesApi } from './dispatch-mock-phone';

const call = makeCallApi('/inventory/deliveries');

export interface DeliveriesPhoneApi {
  /** V1 */
  list: (query: ListDeliveriesQuery) => Promise<ListDeliveries>;
  /** V2. Stamps `arrivedAt` the first time. */
  countView: (id: string) => Promise<CountView>;
  /** V3 PUT */
  saveCount: (id: string, input: SaveCountInput) => Promise<CountView>;
  /** V3 POST: the check on "Check and sign". */
  check: (id: string) => Promise<CheckCountResult>;
  /** V4 PUT */
  setReason: (id: string, lineId: string, input: SetReasonInput) => Promise<CountLine>;
  /** V4 POST (multipart). */
  uploadPhoto: (id: string, lineId: string, file: File) => Promise<UploadPhotoResult>;
  /** V4 DELETE */
  deletePhoto: (id: string, photoId: string) => Promise<DeletePhotoResult>;
  /** V5 */
  confirmPreview: (id: string) => Promise<ConfirmPreview>;
  /** V6. PIN-signed; the idempotency key is in the body. */
  confirm: (id: string, input: ConfirmDeliveryInput) => Promise<ConfirmDeliveryResult>;
  /** The department's read-only delivery file (N3). */
  file: (id: string) => Promise<DispatchFile>;
}

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

async function upload(id: string, lineId: string, file: File): Promise<UploadPhotoResult> {
  const body = new FormData();
  body.set('lineId', lineId);
  body.set('file', file);
  const accessToken = token();
  const response = await fetch(`${env.apiUrl}/inventory/deliveries/${id}/photos`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body,
  });
  const payload = (await response.json()) as ApiResponseEnvelope<UploadPhotoResult>;
  if (!response.ok) throw new ApiError(payload.error?.message ?? 'Request failed', response.status, payload.error?.code ?? 'UNKNOWN_ERROR', payload.error?.details);
  return payload.data as UploadPhotoResult;
}

const realApi: DeliveriesPhoneApi = {
  list: (query) => call<ListDeliveries>('GET', `/mine${queryString(query)}`),
  countView: (id) => call<CountView>('GET', `/${id}/count`),
  saveCount: (id, input) => call<CountView>('PUT', `/${id}/count`, input),
  check: (id) => call<CheckCountResult>('POST', `/${id}/check`, {}),
  setReason: (id, lineId, input) => call<CountLine>('PUT', `/${id}/lines/${lineId}/reason`, input),
  uploadPhoto: upload,
  deletePhoto: (id, photoId) => apiClient.delete<DeletePhotoResult>(`/inventory/deliveries/${id}/photos/${photoId}`, token()),
  confirmPreview: (id) => call<ConfirmPreview>('GET', `/${id}/confirm-preview`),
  confirm: (id, input) => call<ConfirmDeliveryResult>('POST', `/${id}/confirm`, input),
  file: (id) => call<DispatchFile>('GET', `/${id}`),
};

export const deliveriesApi: DeliveriesPhoneApi = MOCK_BRANCH_SIDE ? mockDeliveriesApi : realApi;
