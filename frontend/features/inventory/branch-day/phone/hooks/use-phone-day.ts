import { useLoader } from '../../../_shared/hooks/use-async';
import type { CountView, Home, MyDay, MyHistory, MyHistoryQuery, OpeningView } from '../../_shared/types/branch-day-contract';
import { branchDayPhoneApi } from '../services/branch-day-phone-api';

/** BD1: the head's Day (B0, B4). */
export function useDayHome() {
  return useLoader<Home>('branch-day-home', () => branchDayPhoneApi.home(), 'Could not load your day.');
}

/** BD2: last night's signed figures (B1, B2b). */
export function useOpeningView() {
  return useLoader<OpeningView>('branch-day-opening', () => branchDayPhoneApi.opening(), 'Could not load the opening.');
}

/** BD6: the blind count (B3, B3b, B3c, recount uses the opening instead). */
export function useCountView() {
  return useLoader<CountView>('branch-day-count', () => branchDayPhoneApi.count(), 'Could not load your items.');
}

/** BD9: the head's past days. The key carries every filter so a change reloads. */
export function useMyHistory(query: MyHistoryQuery) {
  const key = `branch-day-mine:${query.from ?? ''}:${query.to ?? ''}:${query.status ?? ''}:${query.page ?? 1}:${query.pageSize ?? 25}`;
  return useLoader<MyHistory>(key, () => branchDayPhoneApi.myHistory(query), 'Could not load your past days.');
}

/** BD10: one past day. */
export function useMyDay(id: string) {
  return useLoader<MyDay>(`branch-day-mine-day:${id}`, () => branchDayPhoneApi.myDay(id), 'Could not load this day.');
}
