import * as React from 'react';

import { WorkforceKpiStrip } from '../../../_shared';
import { hoursUnit } from '../../_shared/lib/shift-look';
import { ALL_DEPARTMENTS, weekNumbers } from '../../_shared/lib/week-view';
import type { WeekView } from '../../_shared/types/rota-types';

/**
 * The four numbers over the grid (Paper step 1), for the department in view: shifts, what needs a look (a button that jumps to the
 * list), hours planned and who is on leave. The estimated cost joins "hours planned" only when the server sent one (HR and the Director).
 */
export function RotaKpis({ week, departmentId, departmentName, onNeedsLook }: { week: WeekView; departmentId: string; departmentName: string; onNeedsLook: () => void }) {
  const n = weekNumbers(week, departmentId);
  const scope = departmentId === ALL_DEPARTMENTS ? 'SHIFTS' : `${departmentName.toUpperCase()} SHIFTS`;
  return (
    <WorkforceKpiStrip
      aria-label="This week at a glance"
      cells={[
        { key: 'shifts', label: scope, value: String(n.shifts), detail: `${n.people} ${n.people === 1 ? 'person' : 'people'} this week` },
        { key: 'look', label: 'NEEDS A LOOK', value: String(n.needsLook), detail: n.lookPhrase, actionable: n.needsLook > 0, onSelect: n.needsLook > 0 ? onNeedsLook : undefined },
        { key: 'hours', label: 'HOURS PLANNED', value: hoursUnit(n.plannedMinutes), detail: week.cost && departmentId === ALL_DEPARTMENTS ? `KES ${Math.round(Number(week.cost.amount)).toLocaleString('en-KE')} est. cost` : `across ${n.people} ${n.people === 1 ? 'person' : 'people'}` },
        { key: 'leave', label: 'ON LEAVE', value: String(n.onLeave), detail: 'approved, shown in grey' },
      ]}
    />
  );
}
