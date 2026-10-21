import type { CircleStep } from '../../../../_shared';
import { waitingOn } from '../../../_shared/lib/leave-copy';
import { momentLabel, momentSince, rangeShort } from '../../../_shared/lib/leave-dates';
import type { ApplicationDetail, LeaveStep } from '../../../_shared/types/leave-types';

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** The server's "Sent to Branch Manager" becomes "sent to your Branch Manager". */
const sentTo = (line: string): string => `sent to ${waitingOn(line.replace(/^Sent to /, ''))}`;

function stepOf(step: LeaveStep, detail: ApplicationDetail): CircleStep {
  const app = detail.application;
  const at = step.at;
  const key = `${step.kind}-${step.state}`;
  switch (step.kind) {
    case 'ASKED':
      return { key, state: 'done', title: 'You asked', line: `${at ? `${momentLabel(at)} · ` : ''}${sentTo(step.line)}` };
    case 'MOVED_TO_HR':
      return { key, state: 'passed', title: 'No answer in 3 days', line: `${at ? `${momentLabel(at)} · ` : ''}it moved to HR` };
    case 'DECIDER': {
      if (step.state === 'CURRENT') {
        const lead = app.movesToHrAt ? `It moves to HR on ${momentLabel(app.movesToHrAt)}` : step.line.includes('moves to HR') ? 'With no answer in 3 days it moves to HR' : '';
        return { key, state: 'current', title: `${capital(waitingOn(step.byRole))} decides`, line: [at ? `Waiting since ${momentSince(at)}` : '', lead].filter(Boolean).join(' · ') };
      }
      const declined = step.state === 'DECLINED';
      return { key, state: declined ? 'declined' : 'done', title: `${capital(waitingOn(step.byRole))} ${declined ? 'declined' : 'approved'}`, line: at ? momentLabel(at) : undefined };
    }
    default: {
      if (step.state === 'TODO') return { key, state: 'todo', title: 'Approved or declined', line: step.line };
      if (step.line.startsWith('Cancelled by the person')) return { key, state: 'cancelled', title: 'You cancelled', line: step.line.replace('Cancelled by the person. ', '') };
      if (step.line.startsWith('Cancelled by a manager')) return { key, state: 'declined', title: `${capital(waitingOn(detail.decision?.byRole ?? null))} cancelled this`, line: 'Your days are back in your balance.' };
      const taken = app.days - app.unpaidTailDays;
      const tail = step.state === 'DONE' ? `${rangeShort(app.start, app.end)} · ${taken} ${taken === 1 ? 'day' : 'days'} taken off your ${app.typeLabel.toLowerCase()}` : rangeShort(app.start, app.end);
      return { key, state: 'done', title: step.line, line: tail };
    }
  }
}

/** The server's steps in the person's own words (Steps 3, 4 and 5). Pure, so the wording is tested once. */
export const circleStepsOf = (detail: ApplicationDetail): CircleStep[] => detail.steps.map((step) => stepOf(step, detail));
