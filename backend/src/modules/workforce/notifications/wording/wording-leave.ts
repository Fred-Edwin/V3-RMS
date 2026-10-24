import type { NotifyData, RenderedNotification } from '../notification-types';
import { text } from './notification-format';

type Wording = (data: NotifyData) => RenderedNotification;

const row = (tone: RenderedNotification['tone'], href: string | null, title: string, body: string, push = true): RenderedNotification => ({ tone, area: 'LEAVE', href, title, body, push });

/** The leave page, with the request opened when the notice carries its id. */
const decide = (d: NotifyData): string => `/app/workforce/leave?tab=requests${d.id ? `&open=${text(d, 'id', '')}` : ''}`;
const mine = (d: NotifyData): string => `/app/workforce/my-leave${d.id ? `?open=${text(d, 'id', '')}` : ''}`;

/**
 * Segment 4 (Leave). The notifier renders ONE text for the Inbox row and the push, so these say only what is safe on a lock screen
 * (spec section 8, L30): no names, no days left, no reasons. The detail is one tap away on the Leave page.
 */
export const LEAVE_WORDING: Record<string, Wording> = {
  'leave.asked': (d) => row('needsLook', decide(d), 'A leave request needs you', 'Open Leave to see it with the shifts.'),
  'leave.approved': (d) => row('done', mine(d), 'Your leave request has an answer', 'Open My leave to see it and your leave slip.'),
  'leave.declined': (d) => row('changed', mine(d), 'Your leave request has an answer', 'Open My leave to see it.'),
  // Inbox only (no push), so the person can be named without a name reaching a lock screen.
  'leave.head_told': (d) => row('information', '/app/workforce/schedule/rota', `${text(d, 'name', 'Someone in your department')} will be on leave`, 'Shifts shows the days.', false),
  'leave.moved_to_hr_person': (d) => row('changed', mine(d), 'Your leave request moved to HR', 'No answer in 3 days. HR decides now.'),
  'leave.moved_to_hr': (d) => row('needsLook', decide(d), 'A leave request needs you', 'It waited 3 days for the Branch Manager.'),
  'leave.cancelled_by_person': () => row('information', '/app/workforce/leave?tab=requests', 'A leave request was cancelled', 'Open Leave to see which.', false),
  'leave.cancelled_by_manager': (d) => row('changed', mine(d), 'Your approved leave was cancelled', 'Open My leave to see why. Your days are back in your balance.'),
  'leave.cancelled_plan_days': () => row('needsLook', '/app/workforce/schedule/rota', 'Leave was cancelled', 'Plan those days on Shifts.'),
  'leave.balance_adjusted': () => row('changed', '/app/workforce/my-leave', 'Your leave balance changed', 'Open My leave to see your days.'),
};
