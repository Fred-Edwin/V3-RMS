import { apiClient } from '@/lib/apiClient';
import { env } from '@/lib/env';
import { useAuthStore } from '@/store/authStore';
import { ApiError, type ApiResponseEnvelope } from '@/types/api';

import type {
  ContractBody,
  CreateLoginBody,
  DraftBody,
  DraftRow,
  ExitBody,
  FileRequestBody,
  HireBody,
  LoanBody,
  PatchMeBody,
  PayChangeBody,
  PayChangeDecisionBody,
  PayProfileBody,
  ProbationDecisionBody,
  ProbationNoteBody,
  RehireBody,
  TransferBody,
  UpdateEmployeeBody,
} from '../types/people-requests';
import type { EmployeeFile, HireResult, MovePreview, PayChangeRow } from '../types/people-types';

/** Every People write (W1 to W28). One function per endpoint; screens never build a path. */

const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;
const BASE = '/workforce/people';

/** The two uploads are multipart, which the JSON client cannot send, so they go through `fetch` here. */
async function upload<T>(path: string, file: File, fields: Record<string, string> = {}): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  const accessToken = token();
  const response = await fetch(`${env.apiUrl}${path}`, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: form,
  });
  const payload = (await response.json()) as ApiResponseEnvelope<T>;
  if (!response.ok) throw new ApiError(payload.error?.message ?? 'Upload failed', response.status, payload.error?.code ?? 'UNKNOWN_ERROR', payload.error?.details);
  return payload.data as T;
}

export const peopleWrites = {
  // Drafts (W2 to W4)
  createDraft: (body: DraftBody): Promise<DraftRow> => apiClient.post(`${BASE}/drafts`, body, token()),
  updateDraft: (id: string, body: DraftBody): Promise<DraftRow> => apiClient.patch(`${BASE}/drafts/${id}`, body, token()),
  deleteDraft: (id: string): Promise<unknown> => apiClient.delete(`${BASE}/drafts/${id}`, token()),
  // Hire (W5), edit (W6, W7), photo (W8)
  hire: (body: HireBody): Promise<HireResult> => apiClient.post(BASE, body, token()),
  update: (id: string, body: UpdateEmployeeBody): Promise<EmployeeFile> => apiClient.patch(`${BASE}/${id}`, body, token()),
  patchMe: (body: PatchMeBody): Promise<EmployeeFile> => apiClient.patch(`${BASE}/me`, body, token()),
  photo: (id: string | 'me', file: File): Promise<EmployeeFile> => upload(`${BASE}/${id}/photo`, file),
  // Pay (W9 to W11)
  updatePayProfile: (id: string, body: PayProfileBody): Promise<unknown> => apiClient.put(`${BASE}/${id}/pay-profile`, body, token()),
  requestPayChange: (id: string, body: PayChangeBody): Promise<PayChangeRow> => apiClient.post(`${BASE}/${id}/pay-changes`, body, token()),
  decidePayChange: (changeId: string, body: PayChangeDecisionBody): Promise<PayChangeRow> => apiClient.post(`${BASE}/pay-changes/${changeId}/decision`, body, token()),
  // Contract and probation (W12 to W14)
  createContract: (id: string, body: ContractBody): Promise<unknown> => apiClient.post(`${BASE}/${id}/contract`, body, token()),
  decideProbation: (id: string, body: ProbationDecisionBody): Promise<EmployeeFile> => apiClient.post(`${BASE}/${id}/probation-decision`, body, token()),
  probationNote: (id: string, body: ProbationNoteBody): Promise<unknown> => apiClient.post(`${BASE}/${id}/probation-notes`, body, token()),
  // Moves (W15 to W18)
  previewTransfer: (id: string, body: TransferBody): Promise<MovePreview> => apiClient.post(`${BASE}/${id}/transfer/preview`, body, token()),
  transfer: (id: string, body: TransferBody): Promise<unknown> => apiClient.post(`${BASE}/${id}/transfer`, body, token()),
  loan: (id: string, body: LoanBody): Promise<unknown> => apiClient.post(`${BASE}/${id}/loan`, body, token()),
  cancelMove: (id: string, moveId: string): Promise<unknown> => apiClient.post(`${BASE}/${id}/moves/${moveId}/cancel`, {}, token()),
  endMove: (id: string, moveId: string): Promise<unknown> => apiClient.post(`${BASE}/${id}/moves/${moveId}/end`, {}, token()),
  // Exit (W19 to W23)
  previewExit: (id: string, body: ExitBody): Promise<MovePreview> => apiClient.post(`${BASE}/${id}/exit/preview`, body, token()),
  exit: (id: string, body: ExitBody): Promise<unknown> => apiClient.post(`${BASE}/${id}/exit`, body, token()),
  exitChecklist: (id: string, uniformReturned: boolean): Promise<unknown> => apiClient.patch(`${BASE}/${id}/exit/checklist`, { uniformReturned }, token()),
  undoExit: (id: string): Promise<unknown> => apiClient.post(`${BASE}/${id}/exit/undo`, {}, token()),
  rehire: (id: string, body: RehireBody): Promise<unknown> => apiClient.post(`${BASE}/${id}/rehire`, body, token()),
  // Login, file requests, statutory, documents, reveal (W24 to W28)
  /** Finding 43: a new temporary password from the server (audited, never emailed). `employeeId` is absent during a hire. */
  newTemporaryPassword: (employeeId?: string): Promise<{ password: string; expiresOn: string }> =>
    apiClient.post(`${BASE}/sign-in/password`, employeeId ? { employeeId } : {}, token()),
  createLogin: (id: string, body: CreateLoginBody): Promise<unknown> => apiClient.post(`${BASE}/${id}/login`, body, token()),
  askForDetail: (id: string, body: FileRequestBody): Promise<unknown> => apiClient.post(`${BASE}/${id}/file-requests`, body, token()),
  remind: (id: string, requestId: string): Promise<unknown> => apiClient.post(`${BASE}/${id}/file-requests/${requestId}/remind`, {}, token()),
  verifyStatutory: (id: string): Promise<unknown> => apiClient.post(`${BASE}/${id}/verify-statutory`, {}, token()),
  uploadDocument: (id: string, file: File, documentType: string): Promise<unknown> => upload(`${BASE}/${id}/documents`, file, { documentType }),
  reveal: (id: string, field: string): Promise<{ field: string; value: string | null }> => apiClient.post(`${BASE}/${id}/reveal`, { field }, token()),
};
