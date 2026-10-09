/**
 * The department's phone calls (contract V1 to V6, plus V7, the member's read-only delivery file). Components never call `fetch`.
 * A department member holds no `dispatch.read`, so the file (N3) comes from `GET /inventory/deliveries/:id` (V7), which returns the
 * same `DispatchFile` shape; the sent figure is only there after the department has counted.
 */
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';
import { makeCallApi, queryString } from '../../_shared/services/scw-call';
import { apiClient } from '@/lib/apiClient';
import type { DispatchFile } from '../../dispatch/_shared/types/dispatch-contract';
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

export const deliveriesApi: DeliveriesPhoneApi = {
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
