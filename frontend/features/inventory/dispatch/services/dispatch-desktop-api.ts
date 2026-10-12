/**
 * The desktop's HTTP service for the store side of Block 2: the dispatch file (P6), the delivery note (P7), cancel (P8) and carriers
 * (P10). Back end C owns all of these, so they always call the real API. The packing endpoints (P1 to P5, P9) belong to the phone lane.
 * Signing writes carry their idempotency key in the body (the contract's rule for P8).
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import { queryString } from '../../_shared/services/scw-call';
import type {
  AddCarrierInput,
  Carrier,
  CancelDispatchInput,
  CancelDispatchResult,
  DeliveryNoteCopy,
  DispatchFile,
  ListCarriers,
  ListCarriersQuery,
  PrintDispatch,
  UpdateCarrierInput,
} from '../_shared/types/dispatch-contract';

const BASE = '/inventory/dispatch';
const CARRIERS = '/inventory/carriers';
const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

export const dispatchDesktopApi = {
  /** P6 */
  file: (id: string): Promise<DispatchFile> => apiClient.get<DispatchFile>(`${BASE}/${id}`, token()),
  /** P7 */
  print: (id: string, copy: DeliveryNoteCopy): Promise<PrintDispatch> => apiClient.get<PrintDispatch>(`${BASE}/${id}/print${queryString({ copy })}`, token()),
  /** P8 */
  cancel: (id: string, input: CancelDispatchInput): Promise<CancelDispatchResult> => apiClient.post<CancelDispatchResult>(`${BASE}/${id}/cancel`, input, token()),

  /** P10 */
  carriers: (query: ListCarriersQuery = {}): Promise<ListCarriers> => apiClient.get<ListCarriers>(`${CARRIERS}${queryString(query)}`, token()),
  addCarrier: (input: AddCarrierInput): Promise<Carrier> => apiClient.post<Carrier>(CARRIERS, input, token()),
  updateCarrier: (id: string, input: UpdateCarrierInput): Promise<Carrier> => apiClient.patch<Carrier>(`${CARRIERS}/${id}`, input, token()),
};
