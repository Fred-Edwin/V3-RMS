/**
 * Branch day, desktop screens: BD6 to BD8 (the Branch Manager counting for a department) and BD11 to BD14 of
 * docs/features/inventory/branch-day-contract.md (base `/inventory/branch-day`). Every call goes through `callApi` (the real client)
 * unless `BRANCH_DAY_MOCK` is on, which serves the contract-shaped fixtures in `lib/mock-data.ts` instead. The mock is ON until
 * feat/block4-be is merged: flip the default below (or set `NEXT_PUBLIC_BRANCH_DAY_MOCK=off`) and nothing else changes. The phone
 * screens have their own service in the phone sub-folder.
 */
import { makeCallApi, queryString } from '../../../_shared/services/scw-call';
import type {
  CloseDayInput,
  CloseDayResult,
  CloseSummary,
  CountView,
  DepartmentFigures,
  SaveCountInput,
  SaveCountResult,
  SignCountInput,
  SignCountResult,
  Today,
  TodayQuery,
} from '../../_shared/types/branch-day-contract';
import { mockBranchDay } from '../lib/mock-data';

const BASE = '/inventory/branch-day';
const callApi = makeCallApi(BASE);

/** True while the back end (Block 4, feat/block4-be) has not landed. */
export const BRANCH_DAY_MOCK = process.env.NEXT_PUBLIC_BRANCH_DAY_MOCK !== 'off';

export const branchDayDeskApi = {
  /** BD11: Today for the Branch Manager's branch, or any branch for a hub role (`branchId`). */
  today: (query: TodayQuery = {}, signal?: AbortSignal): Promise<Today> => (BRANCH_DAY_MOCK ? mockBranchDay.today(query) : callApi<Today>('GET', `/today${queryString(query)}`, undefined, signal)),
  /** BD12: one department's figures; live for an open day, frozen for a closed one. */
  figures: (dayId: string, departmentId: string, signal?: AbortSignal): Promise<DepartmentFigures> =>
    BRANCH_DAY_MOCK ? mockBranchDay.figures(dayId, departmentId) : callApi<DepartmentFigures>('GET', `/days/${dayId}/departments/${departmentId}`, undefined, signal),
  /** BD13: always 200, with `canClose` and the blockers. */
  closeSummary: (dayId: string, signal?: AbortSignal): Promise<CloseSummary> =>
    BRANCH_DAY_MOCK ? mockBranchDay.closeSummary() : callApi<CloseSummary>('GET', `/days/${dayId}/close-summary`, undefined, signal),
  /** BD14: the caller's own PIN. A repeated key returns the first result with `replayed: true`. */
  close: (dayId: string, input: CloseDayInput): Promise<CloseDayResult> =>
    BRANCH_DAY_MOCK ? mockBranchDay.close(dayId, input) : callApi<CloseDayResult>('POST', `/days/${dayId}/close`, input),
  /** BD6: the blind count of a department, for the Branch Manager (`departmentId`). */
  count: (departmentId: string, signal?: AbortSignal): Promise<CountView> =>
    BRANCH_DAY_MOCK ? mockBranchDay.count(departmentId) : callApi<CountView>('GET', `/count${queryString({ departmentId })}`, undefined, signal),
  /** BD7: stores what was typed; last write wins; null clears a figure. */
  saveCount: (departmentId: string, input: Omit<SaveCountInput, 'departmentId'>): Promise<SaveCountResult> =>
    BRANCH_DAY_MOCK ? mockBranchDay.saveCount(departmentId, { ...input, departmentId }) : callApi<SaveCountResult>('PUT', '/count', { ...input, departmentId }),
  /** BD8: signs with the caller's own PIN, recorded "on behalf" for the Branch Manager. */
  signCount: (departmentId: string, input: Omit<SignCountInput, 'departmentId'>): Promise<SignCountResult> =>
    BRANCH_DAY_MOCK ? mockBranchDay.signCount(departmentId, { ...input, departmentId }) : callApi<SignCountResult>('POST', '/count/sign', { ...input, departmentId }),
};
