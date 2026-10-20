import { Callout, PhoneButton } from '../../../../_shared';
import type { RequestableType } from '../../../_shared/types/leave-types';

/**
 * Not enough days (spec Step 8): the days asked are more than the days left. The person may send the short part as unpaid days, or
 * change the dates. The normal Send is replaced, never offered beside this. A type that takes no unpaid tail offers only the dates.
 */
export function ShortfallBlock({ type, days, left, suggestedTail, tailAllowed, paid, sending, disabled, onSendWithTail, onChangeDates }: { type: RequestableType; days: number; left: number; suggestedTail: number; tailAllowed: boolean; paid: boolean; sending: boolean; disabled: boolean; onSendWithTail: () => void; onChangeDates: () => void }) {
  const label = type.label.toLowerCase();
  const title = left === 0 ? `You have no ${label} days left, and this is ${days}.` : `You have ${left} ${label} ${left === 1 ? 'day' : 'days'} left, and this is ${days}.`;
  const line = tailAllowed ? `You can take ${left} ${left === 1 ? 'day' : 'days'} as ${label} leave and ${suggestedTail} as unpaid leave, or choose other dates.` : 'Choose other dates.';
  return (
    <div className="flex flex-col gap-2.5">
      <Callout tone="error" title={title} role="alert">{line}</Callout>
      {tailAllowed ? (
        <PhoneButton size="sm" disabled={disabled} aria-busy={sending} onClick={onSendWithTail}>
          {sending ? 'Sending…' : left === 0 ? `${suggestedTail} unpaid, send` : `${left} ${label} + ${suggestedTail} unpaid, send`}
        </PhoneButton>
      ) : null}
      <PhoneButton kind="outlined" size="sm" onClick={onChangeDates}>Change the dates</PhoneButton>
      {tailAllowed ? (
        <p className="m-0 font-wds-sans text-[12px] leading-4 text-wds-text-secondary">
          Unpaid days are not paid. {paid ? 'Your decider decides, and you will see this on your payslip only if it is approved.' : 'Your decider decides.'}
        </p>
      ) : null}
    </div>
  );
}
