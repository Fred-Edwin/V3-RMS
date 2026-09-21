/**
 * Inventory Milestone Four (Requisition & Branch Approval), Session A — real
 * backend implementation of the frozen contract (`../types`, mirroring
 * `backend/src/modules/requisitions/requisitions-validators.ts`).
 *
 * Same token-reading convention as `prep-api-service.ts`.
 */
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import type {
  DepartmentTag,
  ListRequisitionsQuery,
  OpenRequisitionInput,
  RequisitionListRow,
  RequisitionSectionDetail,
  UpsertRequisitionLinesInput,
} from '../types';

function token(): string | undefined {
  return useAuthStore.getState().accessToken ?? undefined;
}

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function openRequisition(input: OpenRequisitionInput): Promise<RequisitionListRow> {
  return apiClient.post<RequisitionListRow>('/requisitions', input, token());
}

export async function listRequisitions(query: ListRequisitionsQuery = {}): Promise<RequisitionListRow[]> {
  return apiClient.get<RequisitionListRow[]>(`/requisitions${toQueryString(query)}`, token());
}

export async function getRequisitionSection(
  requisitionId: string,
  departmentTag: DepartmentTag,
): Promise<RequisitionSectionDetail> {
  return apiClient.get<RequisitionSectionDetail>(
    `/requisitions/${requisitionId}/sections/${departmentTag}`,
    token(),
  );
}

export async function upsertRequisitionLines(
  requisitionId: string,
  departmentTag: DepartmentTag,
  input: UpsertRequisitionLinesInput,
): Promise<RequisitionSectionDetail> {
  return apiClient.patch<RequisitionSectionDetail>(
    `/requisitions/${requisitionId}/sections/${departmentTag}/lines`,
    input,
    token(),
  );
}

export async function submitRequisitionSection(
  requisitionId: string,
  departmentTag: DepartmentTag,
): Promise<RequisitionSectionDetail> {
  return apiClient.post<RequisitionSectionDetail>(
    `/requisitions/${requisitionId}/sections/${departmentTag}/submit`,
    {},
    token(),
  );
}

export async function recallRequisitionSection(
  requisitionId: string,
  departmentTag: DepartmentTag,
): Promise<RequisitionSectionDetail> {
  return apiClient.post<RequisitionSectionDetail>(
    `/requisitions/${requisitionId}/sections/${departmentTag}/recall`,
    {},
    token(),
  );
}
