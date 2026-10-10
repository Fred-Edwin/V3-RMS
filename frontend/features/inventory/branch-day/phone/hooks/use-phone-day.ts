import { useLoader } from '../../../_shared/hooks/use-async';
import { BRANCH_DAY_STATES_COPY } from '../../_shared/lib/branch-day-copy';
import type { CountView, Home, MyDay, MyHistory, MyHistoryQuery, OpeningView } from '../../_shared/types/branch-day-contract';
import { branchDayPhoneApi } from '../services/branch-day-phone-api';

/** A failed load always says the screen's line from the wording table, never the server's own text. */
const withCopy = <L extends { error: string | null }>(loader: L, line: string): L => ({ ...loader, error: loader.error === null ? null : line });

/** BD1: the head's Day (B0, B4). */
export function useDayHome() {
  return withCopy(useLoader<Home>('branch-day-home', () => branchDayPhoneApi.home(), 'Could not load your day.'), BRANCH_DAY_STATES_COPY.home.error);
}

/** BD2: last night's signed figures (B1, B2b). */
export function useOpeningView() {
  return withCopy(useLoader<OpeningView>('branch-day-opening', () => branchDayPhoneApi.opening(), 'Could not load the opening.'), BRANCH_DAY_STATES_COPY.opening.error);
}

/** BD6: the blind count (B3, B3b, B3c). */
export function useCountView() {
  return withCopy(useLoader<CountView>('branch-day-count', () => branchDayPhoneApi.count(), 'Could not load your items.'), 'Could not load your items. Try again.');
}

/** BD9: the head's past days. The key carries every filter so a change reloads. */
export function useMyHistory(query: MyHistoryQuery) {
  const key = `branch-day-mine:${query.from ?? ''}:${query.to ?? ''}:${query.status ?? ''}:${query.page ?? 1}:${query.pageSize ?? 25}`;
  return withCopy(useLoader<MyHistory>(key, () => branchDayPhoneApi.myHistory(query), 'Could not load your past days.'), BRANCH_DAY_STATES_COPY.myHistory.error);
}

/** BD10: one past day. */
export function useMyDay(id: string) {
  return withCopy(useLoader<MyDay>(`branch-day-mine-day:${id}`, () => branchDayPhoneApi.myDay(id), 'Could not load this day.'), 'Could not load this day. Try again.');
}
