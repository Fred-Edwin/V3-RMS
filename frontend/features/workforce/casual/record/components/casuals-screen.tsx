'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { useAuthStore } from '@/store/authStore';

import { Callout, ChoiceChips, EmptyState, ErrorBlock, ListSkeleton, OfflineStrip, PeriodStepper, PhoneScreen, nameAndRole, useRemote, useWorkforcePermissions } from '../../../_shared';
import { addDays, nairobiToday } from '../../../rota';
import { CASUAL_COPY, dayLong, kes } from '../../_shared/lib/casual-words';
import { casualReads } from '../../_shared/services/casual-services';
import { useDaySheet } from '../hooks/use-day-sheet';
import { DayBody } from './day-body';

/** The head records within the last 3 days (PD23). */
const WINDOW_DAYS = 3;

/**
 * Casuals today (spec S7): the department head records who worked and what each is owed, previews the pay sheet and sends it to the
 * Branch Manager. A head with two departments chooses one first. The day steps back up to 3 days.
 */
export function CasualsScreen() {
  const router = useRouter();
  const search = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const permissions = useWorkforcePermissions();
  const today = React.useMemo(() => nairobiToday(), []);
  const [date, setDate] = React.useState(today);
  const [chosen, setChosen] = React.useState<string | null>(search.get('d'));
  const siteId = permissions.siteId;
  const departments = permissions.headOfDepartmentIds;
  const departmentId = chosen && departments.includes(chosen) ? chosen : departments.length === 1 ? (departments[0] ?? null) : null;

  const names = useRemote(
    async () => (siteId ? Promise.all(departments.map(async (id) => ({ id, name: (await casualReads.day(siteId, id, today)).departmentName }))) : []),
    `dept-names:${departments.join(',')}`,
    permissions.ready && departments.length > 1 && siteId !== null
  );
  const day = useDaySheet(siteId ?? '', departmentId ?? '', date);
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  const frame = (body: React.ReactNode, title = 'Casuals', subtitle?: string) => (
    <PhoneScreen screen={CASUAL_COPY.screen} kicker={`TEAM · CASUALS · ${nameAndRole(user?.name ?? '', user?.role).toUpperCase()}`} back="/app/workforce" title={title} subtitle={subtitle}>
      {body}
    </PhoneScreen>
  );

  if (!permissions.ready) return frame(<ListSkeleton rows={3} columns={['fill', 60]} label="Opening casuals" />);
  if (!permissions.can('casual.record') || !siteId || departments.length === 0) return frame(<EmptyState kind="nothingYet" title="You do not record casual pay" line="Casuals appear here when you head a department." />);
  if (departmentId === null) {
    return frame(
      names.status === 'ready' ? (
        <ChoiceChips legend="Which department?" options={names.data.map((d) => ({ value: d.id, label: d.name }))} value={null} onChange={setChosen} />
      ) : (
        <ListSkeleton rows={2} columns={['fill']} label="Opening departments" />
      )
    );
  }

  const sheet = day.sheet;
  const back = date > addDays(today, -WINDOW_DAYS);
  const head = sheet ? `${dayLong(date)}${sheet.rate ? ` · KES ${kes(sheet.rate)} a day` : ''}` : dayLong(date);
  const stepper = (
    <PeriodStepper label={date === today ? `Today · ${dayLong(date)}` : dayLong(date)} previousLabel="Earlier day" nextLabel="Later day" previousDisabled={!back} nextDisabled={date >= today} onPrevious={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} />
  );

  let body: React.ReactNode;
  if (day.loadError && !sheet) body = <ErrorBlock title="This day did not load" line={day.loadError} onRetry={day.reload} />;
  else if (!sheet) body = <ListSkeleton rows={3} columns={['fill', 60]} label="Opening the day" />;
  else {
    body = (
      <>
        {!online ? <OfflineStrip stillWorks="You can still record and preview. Send waits for a signal." /> : null}
        {day.message ? (
          <Callout tone={day.message.startsWith('Sent') ? 'success' : 'warning'} role="status" action={<button type="button" onClick={day.dismiss} className="min-h-[44px] px-2 font-wds-sans text-[13px] text-wds-primary">Dismiss</button>}>
            {day.message}
          </Callout>
        ) : null}
        <DayBody
          sheet={sheet}
          lines={day.lines}
          pending={day.pending}
          busy={day.busy}
          today={date === today}
          onEdit={day.edit}
          onSend={() => void day.send()}
          onTakeBack={() => void day.takeBack()}
          onPreview={() => sheet.id && !day.pending ? router.push(`/app/workforce/casuals/${sheet.id}/document?preview=1`) : router.push(`/app/workforce/casuals/preview?d=${departmentId}&date=${date}`)}
        />
      </>
    );
  }
  return frame(
    <>
      {stepper}
      {body}
    </>,
    sheet ? `Casuals today · ${sheet.departmentName}` : 'Casuals today',
    head
  );
}
