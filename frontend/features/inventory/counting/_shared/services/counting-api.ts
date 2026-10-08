/**
 * Counting's one HTTP service (contract §4.1, endpoints C1 to C30), typed with the frozen mirror. Every call goes through
 * `callApi`, the fixtures seam. Components never import `apiClient`; they use this through their hooks.
 */
import { makeCallApi, queryString } from '../../../_shared/services/scw-call';
import type {
  AddItemsList,
  AddItemsQuery,
  ApproveInput,
  ApprovePreview,
  BlankSheet,
  CheckResult,
  CountDetail,
  CountRecordPrint,
  CountSettings,
  CountsList,
  CountsListQuery,
  CountsSummary,
  DecisionInput,
  FlaggedList,
  LayoutInput,
  MoveView,
  RepeatShortfallList,
  SaveLinesInput,
  SaveLinesResult,
  SectionItems,
  SectionOrderResult,
  SetupView,
  SettingsPreview,
  SignInput,
  SignPreview,
  StartCountInput,
  StartOptions,
  UpdateSettingsInput,
} from '../types/counting-contract';

const BASE = '/inventory/stock';
const callApi = makeCallApi(BASE);

export const countingApi = {
  /** C1 */
  summary: (audience?: 'manager' | 'director') => callApi<CountsSummary>('GET', `/counts/summary${queryString({ audience })}`),
  /** C2 */
  list: (query: CountsListQuery = {}, signal?: AbortSignal) => callApi<CountsList>('GET', `/counts${queryString(query)}`, undefined, signal),
  /** C3 */
  flagged: (query: { page?: number; pageSize?: number } = {}, signal?: AbortSignal) =>
    callApi<FlaggedList>('GET', `/counts/flagged${queryString(query)}`, undefined, signal),
  /** C4 */
  repeatShortfalls: (query: { page?: number; pageSize?: number } = {}, signal?: AbortSignal) =>
    callApi<RepeatShortfallList>('GET', `/counts/repeat-shortfalls${queryString(query)}`, undefined, signal),
  /** C5 */
  detail: (id: string) => callApi<CountDetail>('GET', `/counts/${id}`),
  /** C6 */
  recordPrint: (id: string) => callApi<CountRecordPrint>('GET', `/counts/${id}/print`),
  /** C7 */
  blankSheet: () => callApi<BlankSheet>('GET', '/counts/blank-sheet'),
  /** C8 */
  startOptions: (recountLineId?: string) => callApi<StartOptions>('GET', `/counts/start-options${queryString({ recountLineId })}`),
  /** C9. A repeated idempotency key returns the same count. */
  start: (input: StartCountInput) => callApi<CountDetail>('POST', '/counts', input),
  /** C10 */
  saveLines: (id: string, input: SaveLinesInput) => callApi<SaveLinesResult>('PUT', `/counts/${id}/lines`, input),
  /** C11 */
  check: (id: string, sectionId: string) => callApi<CheckResult>('POST', `/counts/${id}/check`, { sectionId }),
  /** C12 */
  signPreview: (id: string) => callApi<SignPreview>('GET', `/counts/${id}/sign-preview`),
  /** C13 */
  sign: (id: string, input: SignInput) => callApi<CountDetail>('POST', `/counts/${id}/sign`, input),
  /** C14 */
  sectionOrderToday: (sectionIds: string[]) => callApi<SectionOrderResult>('PUT', '/counts/section-order/today', { sectionIds }),
  /** C15 */
  setup: () => callApi<SetupView>('GET', '/count-setup'),
  /** C16 */
  sectionItems: (sectionId: string) => callApi<SectionItems>('GET', `/count-setup/sections/${sectionId}/items`),
  /** C17 */
  addSection: (name: string) => callApi<SetupView>('POST', '/count-setup/sections', { name }),
  /** C18. A stale `version` is 409 LAYOUT_CHANGED. */
  saveLayout: (input: LayoutInput) => callApi<SetupView>('PUT', '/count-setup/layout', input),
  /** C19 */
  addItemsList: (query: AddItemsQuery, signal?: AbortSignal) => callApi<AddItemsList>('GET', `/count-setup/add-items${queryString(query)}`, undefined, signal),
  /** C20 */
  addItems: (sectionId: string, itemIds: string[]) => callApi<SetupView>('POST', `/count-setup/sections/${sectionId}/items`, { itemIds }),
  /** C21 */
  moveItem: (itemId: string, toSectionId: string) => callApi<MoveView>('POST', `/count-setup/items/${itemId}/move`, { toSectionId }),
  /** C22 */
  undoMove: (moveId: string) => callApi<SetupView>('POST', `/count-setup/moves/${moveId}/undo`, {}),
  /** C23 */
  settings: () => callApi<CountSettings>('GET', '/count-settings'),
  /** C24 */
  settingsPreview: (query: { rangeKes?: number; rangePercent?: string; directorAlertKes?: number }) =>
    callApi<SettingsPreview>('GET', `/count-settings/preview${queryString(query)}`),
  /** C25 */
  updateSettings: (input: UpdateSettingsInput) => callApi<CountSettings>('PUT', '/count-settings', input),
  /** C26 */
  updateDirectorAlert: (alertKes: number) => callApi<CountSettings>('PUT', '/count-settings/director-alert', { alertKes }),
  /** C27 */
  decide: (id: string, input: DecisionInput) => callApi<CountDetail>('POST', `/counts/${id}/decisions`, input),
  /** C28 */
  approvePreview: (id: string) => callApi<ApprovePreview>('GET', `/counts/${id}/approve-preview`),
  /** C29 */
  approve: (id: string, input: ApproveInput) => callApi<CountDetail>('POST', `/counts/${id}/approve`, input),
  /** C30 */
  markSeen: (lineIds: string[]) => callApi<{ seen: number }>('POST', '/counts/seen', { lineIds }),
};
