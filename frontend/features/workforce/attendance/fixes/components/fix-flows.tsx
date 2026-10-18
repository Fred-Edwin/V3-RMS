'use client';

import { Callout, DialogButton, ErrorBlock, KitDialog } from '../../../_shared';
import { useDayHistory } from '../hooks/use-day-data';
import { ClosedShiftDialog } from './closed-shift-dialog';
import { EditTimeDialog } from './edit-time-dialog';

/**
 * The two dialogs that need the person's day first. Each loads it (F1), shows the States kit's error with a retry if that fails, and
 * hands the loaded day to the dialog. `onDone` reloads whatever opened it.
 */

function Failed({ onClose, retry, message }: { onClose: () => void; retry: () => void; message: string }) {
  return (
    <KitDialog open onOpenChange={(o) => !o && onClose()} title="Could not load this day" footer={<DialogButton kind="cancel" size="lg" onClick={onClose}>Close</DialogButton>}>
      <ErrorBlock title="This day did not load" line={message} onRetry={retry} />
    </KitDialog>
  );
}

export function EditTimeFlow({ employeeId, date, entryId, onClose, onDone }: { employeeId: string; date: string; entryId: string | null; onClose: () => void; onDone: (message: string) => void }) {
  const day = useDayHistory(employeeId, date, true);
  if (day.status === 'error' && !day.data) return <Failed onClose={onClose} retry={day.reload} message={day.error.message} />;
  if (!day.data) return null;
  return <EditTimeDialog history={day.data} entryId={entryId} onClose={onClose} onDone={onDone} />;
}

export function ClosedShiftFlow({ employeeId, date, entryId, onClose, onDone }: { employeeId: string; date: string; entryId: string; onClose: () => void; onDone: (message: string) => void }) {
  const day = useDayHistory(employeeId, date, true);
  if (day.status === 'error' && !day.data) return <Failed onClose={onClose} retry={day.reload} message={day.error.message} />;
  if (!day.data) return null;
  return day.data.entries.some((e) => e.entryId === entryId) ? (
    <ClosedShiftDialog history={day.data} entryId={entryId} onClose={onClose} onDone={onDone} />
  ) : (
    <KitDialog open onOpenChange={(o) => !o && onClose()} title="This shift is no longer on the rota" footer={<DialogButton kind="cancel" size="lg" onClick={onClose}>Close</DialogButton>}>
      <Callout tone="warning" size="sm">The shift was removed after it was closed, so there is nothing to put right here. Use Edit time on that day instead.</Callout>
    </KitDialog>
  );
}
