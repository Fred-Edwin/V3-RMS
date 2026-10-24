/**
 * Workforce Attendance (slice 3, front end): the public API. Route shells and the Home cards import from here; nothing deeper is imported
 * from outside this folder. See README.md.
 */
export type { Board, BoardPerson, BoardShift, BoardState, DayHistory, MyDay, MyEntry, SwitchView } from './_shared/types/attendance-types';
export { attendanceReads } from './_shared/services/attendance-services';
export { dayWords, hmOf, hoursAndMinutes } from './_shared/lib/nairobi-clock';

// Phone clock
export { ClockHomeCard } from './clock/components/clock-home-card';
export { ShiftPill } from './clock/components/shift-pill';
export { refreshMyDay, useMyDay } from './clock/hooks/use-my-day';
export { withWorked, type WorkedWeek } from './clock/lib/week-worked';

// Today board and fixing time
export { useBoard } from './board/hooks/use-board';
export { PersonDrawer } from './board/components/person-drawer';
export { CLOCK_OFF_LINE, chipItems, clockOffCopy, departmentCountRows, departmentRows, exceptionRows, fixedWords, kpiCells, liveLine, lookItems, type ClockOffCopy, type DepartmentCountRow, type ExceptionRow, type LookItem } from './board/lib/board-view';
export { ClockForDialog } from './fixes/components/clock-for-dialog';
export { ClosedShiftFlow, EditTimeFlow } from './fixes/components/fix-flows';
export { EditTimeDialog } from './fixes/components/edit-time-dialog';
export { useDayHistory } from './fixes/hooks/use-day-data';
export { dateOf, longDayWords } from './_shared/lib/nairobi-clock';

// The Time tab and the Overview tiles on the employee file (Schedule V1)
export { TimeFileTab } from './time-tab/components/time-tab';
export { TimeTiles } from './time-tab/components/overview-tiles';

// The switch
export { SwitchScreen } from './switch/components/switch-screen';
export { attendanceAskOf, forgetAttendanceOn, useAttendanceOn } from './switch/hooks/use-attendance-on';
