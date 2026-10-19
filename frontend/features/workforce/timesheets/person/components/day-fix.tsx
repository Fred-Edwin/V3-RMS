'use client';

import { ErrorBlock } from '../../../_shared';
import { EditTimeDialog, useDayHistory } from '../../../attendance';

/** Opens Attendance's Edit time for one day: loads the day's clock events, then shows the same dialog the Today board uses. */
export function DayFix({ employeeId, date, onClose, onDone }: { employeeId: string; date: string; onClose: () => void; onDone: (message: string) => void }) {
  const history = useDayHistory(employeeId, date, true);
  if (!history.data) return history.status === 'error' ? <ErrorBlock title="This day did not load" line={history.error.message} onRetry={history.reload} /> : null;
  return <EditTimeDialog history={history.data} entryId={history.data.entries[0]?.entryId ?? null} onClose={onClose} onDone={onDone} />;
}
