import { workforceEvents } from '../../_shared/events';
import { told } from '../../people/people-context';

let registered = false;

/**
 * Turns the batched `rota.shifts_changed` event into "your shifts changed" for that person. Until Notifications exist the
 * Workforce notifier only logs, so this is the whole delivery for now. Idempotent.
 */
export function registerChangeNotices(): void {
  if (registered) return;
  registered = true;
  workforceEvents.on('rota.shifts_changed', (event) => {
    const { userId, dates, changeCount } = event.payload;
    void told([userId], 'rota.shifts_changed', { firstDate: dates[0] ?? null, lastDate: dates[dates.length - 1] ?? null, days: dates.length, changes: changeCount });
  });
}
