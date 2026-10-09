import { useLoader } from '../../_shared/hooks/use-async';
import { useBlock2Nudge } from '../../_shared/hooks/use-block2-nudge';
import type { DispatchFile, DispatchMine, DispatchMineQuery, PackDepartment, Queue, Review } from '../_shared/types/dispatch-contract';
import { dispatchPhoneApi } from '../services/dispatch-phone-api';

/** P1: To pack. Reloads when a head sends or another packer signs. */
export function useDispatchQueue() {
  const loader = useLoader<Queue>('dispatch-queue', () => dispatchPhoneApi.queue(), 'Could not load To pack.');
  useBlock2Nudge(() => void loader.reload());
  return loader;
}

/** P2: one department's lines. The screen decides what a nudge may replace (it keeps the lines the packer has touched). */
export function usePackDepartment(requisitionId: string, departmentId: string) {
  const loader = useLoader<PackDepartment>(`pack:${requisitionId}:${departmentId}`, () => dispatchPhoneApi.department(requisitionId, departmentId), 'Could not load this department.');
  useBlock2Nudge(() => void loader.reload());
  return loader;
}

/** P4: the final review and the "every department packed" list. */
export function usePackReview(requisitionId: string) {
  const loader = useLoader<Review>(`pack-review:${requisitionId}`, () => dispatchPhoneApi.review(requisitionId), 'Could not load the review.');
  useBlock2Nudge(() => void loader.reload());
  return loader;
}

/** P6: the dispatch file (N1). */
export function useDispatchFile(id: string) {
  const loader = useLoader<DispatchFile>(`dispatch-file:${id}`, () => dispatchPhoneApi.file(id), 'Could not load this dispatch.');
  useBlock2Nudge(() => void loader.reload());
  return loader;
}

/** P9: the On the way and Done tabs. The key carries every filter so a change reloads. */
export function useDispatchMine(query: DispatchMineQuery) {
  const key = `dispatch-mine:${query.tab ?? ''}:${query.from ?? ''}:${query.to ?? ''}:${query.branchId ?? ''}:${query.page ?? 1}:${query.pageSize ?? 25}`;
  const loader = useLoader<DispatchMine>(key, () => dispatchPhoneApi.mine(query), 'Could not load dispatches.');
  useBlock2Nudge(() => void loader.reload());
  return loader;
}
