import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { attachWorkforceSubject } from '../people/people-subject';
import { ATTENDANCE_BASE as A } from './attendance.constants';
import { boardController as board } from './board/board-controller';
import { clockController as clock } from './clock/clock-controller';
import { fixesController as fixes } from './fixes/fixes-controller';
import { latenessController as lateness } from './lateness/lateness-controller';
import { switchController as site } from './switch/switch-controller';

/**
 * The Attendance endpoints (C1 to C5 for the phone, B1 B2 the Today board, F1 to F3 fixing time, L1 lateness, S1 S2 the
 * switch). Every route: authenticate, then attachWorkforceSubject (head rows), then the capability; scope is checked in the
 * service on the actual person. There is no requireRole anywhere in the module.
 */
const router = Router();
const base = [authenticate, attachWorkforceSubject] as const;

router.get(`${A}/me`, ...base, requireCapability('time.own'), clock.me); // C1
router.post(`${A}/clock-in`, ...base, requireCapability('time.own'), clock.clockIn); // C2
router.post(`${A}/clock-out`, ...base, requireCapability('time.own'), clock.clockOut); // C3
router.post(`${A}/undo`, ...base, requireCapability('time.own'), clock.undo); // C4
router.post(`${A}/shift-end`, ...base, requireCapability('time.own'), clock.shiftEnd); // C5

router.get(`${A}/board`, ...base, requireCapability('today.read'), board.board); // B1
router.post(`${A}/clock-for`, ...base, requireCapability('today.act'), board.clockFor); // B2

router.get(`${A}/day`, ...base, requireCapability('timesheet.read', 'today.read'), fixes.day); // F1 (a head reads their department's)
router.post(`${A}/fixes/preview`, ...base, requireCapability('time.fix'), fixes.preview); // F2
router.post(`${A}/fixes`, ...base, requireCapability('time.fix'), fixes.apply); // F3

router.get(`${A}/lateness`, ...base, requireCapability('timesheet.read', 'today.read'), lateness.report); // L1 (a head reads their department's)

router.get(`${A}/switch`, ...base, requireCapability('today.read'), site.get); // S1
router.put(`${A}/switch`, ...base, requireCapability('attendance.switch'), site.set); // S2
router.get(`${A}/switch/sites`, ...base, requireCapability('today.read'), site.list); // S3

export default router;
