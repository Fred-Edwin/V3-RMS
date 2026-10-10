/**
 * Branch day, desktop screens: BD6 to BD8 (the Branch Manager counting for a department) and BD11 to BD21 of
 * docs/features/inventory/branch-day-contract.md (base `/inventory/branch-day`). Every call goes through `callApi`, the real client.
 */
import { makeCallApi, queryString } from '../../../_shared/services/scw-call';
import type {
  CloseDayInput,
  CloseDayResult,
  CloseSummary,
  CorrectCountInput,
  CorrectCountResult,
  CountView,
  DayActivity,
  DayDocuments,
  DayFile,
  DaySheet,
  DepartmentFigures,
  History,
  HistoryQuery,
  SaveCountInput,
  SaveCountResult,
  SignCountInput,
  SignCountResult,
  Today,
  TodayQuery,
} from '../../_shared/types/branch-day-contract';

const callApi = makeCallApi('/inventory/branch-day');

export const branchDayDeskApi = {
  /** BD11: Today for the Branch Manager's branch, or any branch for a hub role (`branchId`). */
  today: (query: TodayQuery = {}, signal?: AbortSignal): Promise<Today> => callApi<Today>('GET', `/today${queryString(query)}`, undefined, signal),
  /** BD12: one department's figures; live for an open day, frozen for a closed one. */
  figures: (dayId: string, departmentId: string, signal?: AbortSignal): Promise<DepartmentFigures> => callApi<DepartmentFigures>('GET', `/days/${dayId}/departments/${departmentId}`, undefined, signal),
  /** BD13: always 200, with `canClose` and the blockers. */
  closeSummary: (dayId: string, signal?: AbortSignal): Promise<CloseSummary> => callApi<CloseSummary>('GET', `/days/${dayId}/close-summary`, undefined, signal),
  /** BD14: the caller's own PIN. A repeated key returns the first result with `replayed: true`. */
  close: (dayId: string, input: CloseDayInput): Promise<CloseDayResult> => callApi<CloseDayResult>('POST', `/days/${dayId}/close`, input),
  /** BD15: History, newest first; the branch picker's options come back for a hub role. */
  history: (query: HistoryQuery, signal?: AbortSignal): Promise<History> => callApi<History>('GET', `/history${queryString(query)}`, undefined, signal),
  /** BD16: the day file's header, tracker, rail, tab counts and what the caller may do. */
  dayFile: (dayId: string, signal?: AbortSignal): Promise<DayFile> => callApi<DayFile>('GET', `/days/${dayId}`, undefined, signal),
  /** BD17: newest first. */
  activity: (dayId: string, limit?: number, signal?: AbortSignal): Promise<DayActivity> => callApi<DayActivity>('GET', `/days/${dayId}/activity${queryString({ limit })}`, undefined, signal),
  /** BD18: the day sheet versions, newest first. */
  documents: (dayId: string, signal?: AbortSignal): Promise<DayDocuments> => callApi<DayDocuments>('GET', `/days/${dayId}/documents`, undefined, signal),
  /** BD20: the caller's own PIN. One item, one reason; a repeated key returns the first result with `replayed: true`. */
  correct: (dayId: string, input: CorrectCountInput): Promise<CorrectCountResult> => callApi<CorrectCountResult>('POST', `/days/${dayId}/corrections`, input),
  /** BD21: the stored copy of one version (the latest by default). Reading it writes nothing. */
  sheet: (dayId: string, version?: number, signal?: AbortSignal): Promise<DaySheet> => callApi<DaySheet>('GET', `/days/${dayId}/sheet${queryString({ version })}`, undefined, signal),
  /** BD6: the blind count of a department, for the Branch Manager (`departmentId`). */
  count: (departmentId: string, signal?: AbortSignal): Promise<CountView> => callApi<CountView>('GET', `/count${queryString({ departmentId })}`, undefined, signal),
  /** BD7: stores what was typed; last write wins; null clears a figure. */
  saveCount: (departmentId: string, input: Omit<SaveCountInput, 'departmentId'>): Promise<SaveCountResult> => callApi<SaveCountResult>('PUT', '/count', { ...input, departmentId }),
  /** BD8: signs with the caller's own PIN, recorded "on behalf" for the Branch Manager. */
  signCount: (departmentId: string, input: Omit<SignCountInput, 'departmentId'>): Promise<SignCountResult> => callApi<SignCountResult>('POST', '/count/sign', { ...input, departmentId }),
};
