/**
 * The one thing the app shell reads from Attendance: whether the new clock is on for this person's branch. A separate entry so the shell
 * (which the Workforce kit itself imports) does not pull in the screens, which import the kit.
 */
export { attendanceAskOf, forgetAttendanceOn, useAttendanceOn } from './switch/hooks/use-attendance-on';
