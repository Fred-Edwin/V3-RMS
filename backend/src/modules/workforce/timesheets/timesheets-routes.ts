import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { attachWorkforceSubject } from '../people/people-subject';
import { daysController as days } from './days/days-controller';
import { meController as me } from './me/me-controller';
import { overtimeController as overtime } from './overtime/overtime-controller';
import { periodsController as periods } from './periods/periods-controller';
import { reportController as report } from './report/report-controller';
import { requestsController as requests } from './requests/requests-controller';

/**
 * The Timesheets endpoints (slice 4a). Every route: authenticate, then attachWorkforceSubject (head rows), then the
 * capability; scope is checked in the service on the actual record. There is no requireRole anywhere in the module.
 *   T1-T3 periods · T4 a person's period · T5 a day · T6 decide a day · O1-O2 overtime · P1-P2 the report and its signature
 *   P3-P4 close early and reopen · R1-R6 requests · M1-M2 My time and My rota
 */
const T = '/workforce/timesheets';
const router = Router();
const base = [authenticate, attachWorkforceSubject] as const;

router.get(`${T}/periods`, ...base, requireCapability('timesheet.read'), periods.list); // T1
router.get(`${T}/periods/:id`, ...base, requireCapability('timesheet.read'), periods.get); // T2
router.get(`${T}/periods/:id/people/:employeeId`, ...base, requireCapability('timesheet.read'), days.person); // T4
router.get(`${T}/days/:id`, ...base, requireCapability('timesheet.read'), days.day); // T5
router.post(`${T}/days/:id/decision`, ...base, requireCapability('timesheet.approve'), days.decide); // T6

router.get(`${T}/overtime`, ...base, requireCapability('timesheet.read'), overtime.list); // O1
router.post(`${T}/overtime/:id/decision`, ...base, requireCapability('overtime.approve'), overtime.decide); // O2

router.get(`${T}/periods/:id/report`, ...base, requireCapability('timesheet.read'), report.get); // P1 (TSH-0007)
router.post(`${T}/periods/:id/sign`, ...base, requireCapability('timesheet.close'), periods.sign); // P2
router.post(`${T}/periods/:id/close`, ...base, requireCapability('timesheet.close'), periods.close); // P3
router.post(`${T}/periods/:id/reopen`, ...base, requireCapability('timesheet.reopen'), periods.reopen); // P4

router.get(`${T}/requests`, ...base, requireCapability('timesheet.read'), requests.inbox); // R1 the manager's inbox
router.post(`${T}/requests/:id/decision`, ...base, requireCapability('timesheet.approve'), requests.decide); // R2
router.get(`${T}/requests/:id`, ...base, requireCapability('timesheet.read', 'time.own'), requests.detail); // R3 (its owner, or a reader in scope)
router.get(`${T}/me/requests`, ...base, requireCapability('time.own'), requests.mine); // R4 My requests
router.post(`${T}/me/requests`, ...base, requireCapability('time.own'), requests.create); // R5 Report a problem
router.post(`${T}/me/requests/:id/withdraw`, ...base, requireCapability('time.own'), requests.withdraw); // R6

router.get(`${T}/me/time`, ...base, requireCapability('time.own'), me.time); // M1
router.get(`${T}/me/rota`, ...base, requireCapability('time.own'), me.rota); // M2

export default router;
