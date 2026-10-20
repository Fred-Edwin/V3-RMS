import type { NairobiDate } from '../../_shared/time/nairobi-time';
import type { ApplicationRow } from '../data/applications-repository';
import type { LeaveEventRow } from '../data/events-repository';
import { DECIDER_WORDS, roleWord } from '../leave-words';
import { phaseOf } from './leave-phase';
import { effectiveStage, movesToHrAt } from './leave-routing';

export type StepKind = 'ASKED' | 'MOVED_TO_HR' | 'DECIDER' | 'ENDING';
export type StepState = 'DONE' | 'CURRENT' | 'DECLINED' | 'PASSED' | 'TODO';

export interface LeaveStep {
  kind: StepKind;
  state: StepState;
  at: string | null;
  byRole: string | null;
  line: string;
}

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

/**
 * The steps of one request for the stepper (M3). Built from the request and its events; the "moved to HR" step is DERIVED from the
 * ask time, so it shows after 72 hours even when the hourly job has not written the event (L20).
 */
export function buildSteps(args: { app: ApplicationRow; personUserId: string | null; events: readonly LeaveEventRow[]; now: Date; today: NairobiDate }): LeaveStep[] {
  const { app, now, today } = args;
  const siteManager = app.routedToRole === 'MANAGER' || app.routedToRole === 'STORE_MANAGER';
  const firstWord = DECIDER_WORDS[app.routedToRole as keyof typeof DECIDER_WORDS] ?? 'HR';
  const steps: LeaveStep[] = [{ kind: 'ASKED', state: 'DONE', at: iso(app.askedAt), byRole: null, line: `Sent to ${firstWord}` }];

  const moved = siteManager && (app.withHrAt !== null || now >= movesToHrAt(app.askedAt) || args.events.some((event) => event.kind === 'MOVED_TO_HR'));
  if (moved) steps.push({ kind: 'MOVED_TO_HR', state: 'PASSED', at: iso(app.withHrAt ?? movesToHrAt(app.askedAt)), byRole: null, line: 'No answer in 3 days. HR decides now.' });
  const stage = effectiveStage(app, now);
  const waitingWord = stage === 'HR' ? 'HR' : stage === 'DIRECTOR' ? 'Director' : firstWord;

  if (app.status === 'WAITING') {
    steps.push({ kind: 'DECIDER', state: 'CURRENT', at: iso(app.withHrAt ?? app.askedAt), byRole: waitingWord, line: siteManager && !moved ? `The ${waitingWord} decides. With no answer in 3 days it moves to HR` : `The ${waitingWord} decides` });
    steps.push({ kind: 'ENDING', state: 'TODO', at: null, byRole: null, line: 'You will be told here and in your Inbox' });
    return steps;
  }
  if (app.decidedAt) {
    const word = roleWord(app.deciderRole);
    steps.push({ kind: 'DECIDER', state: app.status === 'DECLINED' ? 'DECLINED' : 'DONE', at: iso(app.decidedAt), byRole: word, line: app.status === 'DECLINED' ? `The ${word} declined` : `The ${word} approved` });
  }
  if (app.status === 'APPROVED') {
    const phase = phaseOf(app, today);
    const line = phase === 'BOOKED' ? 'Approved · leave booked' : phase === 'ON_LEAVE' ? 'Approved · on leave now' : 'Approved · leave taken';
    steps.push({ kind: 'ENDING', state: phase === 'BOOKED' ? 'CURRENT' : 'DONE', at: null, byRole: null, line });
  }
  if (app.status === 'CANCELLED') {
    const byManager = app.cancelledBy !== null && app.cancelledBy !== args.personUserId;
    const line = byManager ? 'Cancelled by a manager. The days are back in the balance.' : app.decidedAt ? 'Cancelled by the person. The days are back in the balance.' : 'Cancelled by the person. Nothing was taken off the balance.';
    steps.push({ kind: 'ENDING', state: 'DONE', at: iso(app.cancelledAt), byRole: null, line });
  }
  return steps;
}
