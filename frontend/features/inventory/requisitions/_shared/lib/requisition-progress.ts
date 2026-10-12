import type { ProgressStep } from '../../../dispatch/lib/dispatch-words';
import type { TrackerStep } from '../types/requisitions-contract';
import { clock } from './requisitions-words';

const nameComma = (by: { name: string; roleLabel: string } | null): string => (by ? `${by.name}, ${by.roleLabel}` : '');
const join = (parts: (string | null | undefined | false)[]): string => parts.filter(Boolean).join(' · ');

/**
 * The requisition's tracker as Paper D22 draws it: Asked, Approved, Packed and signed, On the way, Counted (one standard for every
 * role and width). The back end sends facts per step (`STARTED`, `ALL_IN`, `APPROVED`, `PACKED` with "n of m sent", `DELIVERED` with
 * "n counted", `CLOSED`); the words and the five-step shape are written here. An amber ring means someone has to act.
 */
export function requisitionProgress(steps: readonly TrackerStep[], canApprove: boolean): ProgressStep[] {
  const get = (key: TrackerStep['key']): TrackerStep | undefined => steps.find((s) => s.key === key);
  const started = get('STARTED');
  const allIn = get('ALL_IN');
  const approved = get('APPROVED');
  const packed = get('PACKED');
  const delivered = get('DELIVERED');
  const sent = packed?.count?.done ?? 0;
  const total = packed?.count?.total ?? delivered?.count?.total ?? 0;
  const counted = delivered?.count?.done ?? 0;
  const at = (s: TrackerStep | undefined): string => (s?.at ? clock(s.at) : '');

  const approvedState = approved?.state ?? 'TODO';
  const wayState: ProgressStep['state'] = delivered?.state === 'DONE' ? 'DONE' : sent > 0 ? 'CURRENT' : 'TODO';

  return [
    { key: 'ASKED', state: started?.state ?? 'DONE', tone: 'ok', label: 'Asked', second: join([at(started), nameComma(started?.by ?? null)]) },
    {
      key: 'APPROVED',
      state: approvedState,
      tone: approvedState === 'CURRENT' && canApprove ? 'act' : 'ok',
      label: 'Approved',
      second:
        approvedState === 'DONE'
          ? join([at(approved), nameComma(approved?.by ?? null)])
          : allIn && allIn.state !== 'DONE' && allIn.count
            ? `${allIn.count.done} of ${allIn.count.total} sections in`
            : approvedState === 'CURRENT'
              ? canApprove
                ? 'Waiting for you'
                : 'Waiting for the Branch Manager'
              : 'Branch Manager',
    },
    {
      key: 'PACKED',
      state: sent > 0 && sent >= total && total > 0 ? 'DONE' : packed?.state === 'CURRENT' ? 'CURRENT' : sent > 0 ? 'DONE' : 'TODO',
      tone: 'ok',
      label: 'Packed and signed',
      second: sent > 0 ? join([at(packed), nameComma(packed?.by ?? null)]) : packed?.state === 'CURRENT' ? 'Central Store · waiting' : 'Central Store',
    },
    { key: 'ON_THE_WAY', state: wayState, tone: 'ok', label: 'On the way', second: sent > 0 ? join([at(packed), `${sent} of ${total} sent`]) : '' },
    { key: 'COUNTED', state: delivered?.state === 'DONE' ? 'DONE' : 'TODO', tone: 'ok', label: 'Counted', second: delivered?.state === 'DONE' ? at(delivered) : total > 0 ? `${counted} of ${total} counted` : 'Each department' },
  ];
}
