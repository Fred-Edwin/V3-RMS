import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';

import type {
  AppealReasonKey,
  ConductAbout,
  ConductLevel,
  DecisionOutcome,
  DecisionPreview,
  DeskList,
  DeskQuery,
  Draft,
  FileBlob,
  FileTab,
  IssueBody,
  Issued,
  IssuePerson,
  NoticeDetail,
  NotSignedReason,
  StaffList,
  WitnessCard,
  WitnessOption,
} from '../types/conduct-types';
import { conductFile } from './conduct-file-http';

/** One function per endpoint of API_CONTRACT §44. The token comes from the auth store, as the other Workforce services do. */
const BASE = '/workforce/conduct';
const token = (): string | undefined => useAuthStore.getState().accessToken ?? undefined;

const query = (params: Record<string, string | number | undefined>): string => {
  const pairs = Object.entries(params).filter((e): e is [string, string | number] => e[1] !== undefined && e[1] !== '');
  return pairs.length ? `?${pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

export const conductReads = {
  mine: (): Promise<StaffList> => apiClient.get(`${BASE}/me`, token()),
  badge: (): Promise<{ count: number }> => apiClient.get(`${BASE}/badge`, token()),
  desk: (q: DeskQuery): Promise<DeskList> => apiClient.get(`${BASE}${query({ status: q.status, q: q.q, site: q.site, page: q.page, pageSize: q.pageSize })}`, token()),
  detail: (id: string): Promise<NoticeDetail> => apiClient.get(`${BASE}/${id}`, token()),
  people: (q: string): Promise<IssuePerson[]> => apiClient.get(`${BASE}/people${query({ q, purpose: 'issue' })}`, token()),
  draft: (personId: string, about: ConductAbout, month?: string): Promise<Draft> => apiClient.get(`${BASE}/draft${query({ personId, about, month })}`, token()),
  witnessOptions: (id: string, q: string): Promise<WitnessOption[]> => apiClient.get(`${BASE}/${id}/witness-options${query({ q })}`, token()),
  witnessCard: (id: string): Promise<WitnessCard> => apiClient.get(`${BASE}/${id}/witness`, token()),
  fileTab: (employeeId: string): Promise<FileTab> => apiClient.get(`/workforce/people/${employeeId}/conduct`, token()),
  /** The sites for HR's and the Director's Site select: only the names are used. (People's lookups; read here so Conduct never imports People.) */
  sites: async (): Promise<{ id: string; name: string }[]> => (await apiClient.get<{ organizations: { id: string; name: string }[] }>('/workforce/people/lookups', token())).organizations.map((o) => ({ id: o.id, name: o.name })),
};

/** The letter. `version` is 1 (as issued, for HR, the Director and the issuer), 2, 3 or the latest. */
export const conductFiles = {
  document: (id: string, version: 1 | 2 | 3 | 'latest', inline: boolean): Promise<FileBlob> => conductFile(`${BASE}/${id}/document${query({ version: String(version), inline: inline ? '1' : '0' })}`, 'Warning-notice.pdf'),
  draftPreview: (body: { personId: string; level: ConductLevel; about: ConductAbout; factsMonth?: string; ownLine: string }): Promise<FileBlob> => conductFile(`${BASE}/draft/preview`, 'Warning-notice-draft.pdf', body),
};

export const conductWrites = {
  issue: (body: IssueBody): Promise<Issued> => apiClient.post(BASE, body, token()),
  sign: (id: string, body: { code: string; deviceId: string; idempotencyKey: string }): Promise<unknown> => apiClient.post(`${BASE}/${id}/sign`, body, token()),
  appeal: (id: string, body: { reasonKey: AppealReasonKey; text: string; idempotencyKey: string }): Promise<unknown> => apiClient.post(`${BASE}/${id}/appeal`, body, token()),
  notSigned: (id: string, body: { reason: NotSignedReason; witnessId: string; pin: string; idempotencyKey: string }): Promise<unknown> => apiClient.post(`${BASE}/${id}/not-signed`, body, token()),
  witness: (id: string, body: { confirmed: boolean; code?: string }): Promise<{ answered: 'CONFIRMED' | 'DECLINED' }> => apiClient.post(`${BASE}/${id}/witness`, body, token()),
  decisionPreview: (id: string, outcome: DecisionOutcome): Promise<DecisionPreview> => apiClient.post(`${BASE}/${id}/decision/preview`, { outcome }, token()),
  decide: (id: string, body: { outcome: DecisionOutcome; reason: string; pin: string; idempotencyKey: string }): Promise<unknown> => apiClient.post(`${BASE}/${id}/decision`, body, token()),
};
