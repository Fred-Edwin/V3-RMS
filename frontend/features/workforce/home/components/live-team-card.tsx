'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { useWorkforcePermissions } from '../../_shared';
import { ClockForDialog, lookItems, type Board, type BoardShift } from '../../attendance';
import { ServiceTeamCard, type TeamRow } from './phone-cards';

/**
 * "Your team today" on a department head's phone (Paper QKM-0), from the Today board: the ring of people in, the faces, who is late or
 * not in, and the one button the head may use ("Clock in for <name>", only with `today.act`). "Open" goes to the full board.
 */
export function LiveTeamCard({ board, reload }: { board: Board; reload: () => void }) {
  const router = useRouter();
  const { can } = useWorkforcePermissions();
  const [clockFor, setClockFor] = React.useState<{ employeeId: string; name: string; department: string; shift: BoardShift } | null>(null);
  const present = board.departments.reduce((n, d) => n + d.present, 0);
  const expected = board.departments.reduce((n, d) => n + d.expected, 0);
  const lateCount = board.tiles.late.count;
  const notInCount = board.tiles.notIn.count;
  const title = board.departments.length === 1 ? `${board.departments[0]?.name ?? ''} team today` : 'Your team today';
  const inNow = board.people.filter((p) => ['ON_SHIFT', 'LATE', 'ENDING', 'STAYED_ON', 'FINISHED'].includes(p.state)).map((p) => p.name);

  const rows: TeamRow[] = lookItems(board)
    .filter((i) => i.kind === 'NOT_IN' || i.kind === 'LATE')
    .map((i) => {
      const shift = board.people.find((p) => p.employeeId === i.employeeId)?.shifts.find((s) => s.entryId === i.entryId);
      const first = i.name.split(/\s+/)[0] ?? i.name;
      return {
        key: i.key,
        name: i.name,
        status: i.status,
        tone: i.tone,
        late: i.late,
        action: i.kind === 'NOT_IN' && shift && can('today.act') ? { label: `Clock in for ${first}`, onClick: () => setClockFor({ employeeId: i.employeeId, name: i.name, department: i.department, shift }) } : undefined,
      };
    });

  return (
    <>
      <ServiceTeamCard title={title} expected={expected} present={present} people={inNow} lateCount={lateCount} notInCount={notInCount} rows={rows} open={{ label: 'Open', onClick: () => router.push('/app/workforce/today') }} />
      {clockFor ? (
        <ClockForDialog
          employeeId={clockFor.employeeId}
          name={clockFor.name}
          department={clockFor.department}
          shiftLine={`${clockFor.shift.templateName} ${clockFor.shift.startTime} to ${clockFor.shift.endTime}`}
          startsAt={`${board.date}T${clockFor.shift.startTime}:00+03:00`}
          date={board.date}
          onClose={() => setClockFor(null)}
          onDone={() => {
            setClockFor(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}
