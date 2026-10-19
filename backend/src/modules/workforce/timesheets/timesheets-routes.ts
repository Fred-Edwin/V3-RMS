import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { attachWorkforceSubject } from '../people/people-subject';
import { daysController as days } from './days/days-controller';
import { meController as me } from './me/me-controller';
import { monthsController as months } from './months/months-controller';
import { overtimeController as overtime } from './overtime/overtime-controller';
import { requestsController as requests } from './requests/requests-controller';

/**
 * The Timesheets endpoints (slice 4a, reworked by Segment 1A to one month-based feature). Every route: authenticate, then
 * attachWorkforceSubject (head rows), then the capability; scope is checked in the service on the actual record. There is no
 * requireRole anywhere in the module.
 *   MO1 months list · MO2 a month · MO3 its people · MO4 a person's drawer · MO5 a person's days · MO6 approve the month · MO7 export
 *   T5 a day · T6 decide a day · O1-O4 overtime (list, detail, decision, head's note) · R1-R6 requests · M1-M2 My time and My rota
 */
const T = '/workforce/timesheets';
const router = Router();
const base = [authenticate, attachWorkforceSubject] as const;

router.get(`${T}/months`, ...base, requireCapability('timesheet.read'), months.list); // MO1
router.get(`${T}/months/:monthKey`, ...base, requireCapability('timesheet.read'), months.get); // MO2
router.get(`${T}/months/:monthKey/people`, ...base, requireCapability('timesheet.read'), months.people); // MO3
router.get(`${T}/months/:monthKey/people/:employeeId`, ...base, requireCapability('timesheet.read'), months.person); // MO4
router.get(`${T}/months/:monthKey/people/:employeeId/days`, ...base, requireCapability('timesheet.read'), months.personDays); // MO5
router.post(`${T}/months/:monthKey/approve`, ...base, requireCapability('timesheet.close'), months.approve); // MO6
router.post(`${T}/months/:monthKey/exports`, ...base, requireCapability('timesheet.export'), months.export); // MO7

router.get(`${T}/days/:id`, ...base, requireCapability('timesheet.read'), days.day); // T5
router.post(`${T}/days/:id/decision`, ...base, requireCapability('timesheet.approve', 'manager_time.decide'), days.decide); // T6

router.get(`${T}/overtime`, ...base, requireCapability('timesheet.read'), overtime.list); // O1
router.get(`${T}/overtime/:id`, ...base, requireCapability('timesheet.read'), overtime.detail); // O3 the evidence beside the decision
router.post(`${T}/overtime/:id/decision`, ...base, requireCapability('overtime.approve', 'manager_time.decide'), overtime.decide); // O2
router.post(`${T}/overtime/:id/note`, ...base, requireCapability('overtime.note'), overtime.note); // O4 a head's one-line note

router.get(`${T}/requests`, ...base, requireCapability('timesheet.read'), requests.inbox); // R1 the manager's inbox
router.post(`${T}/requests/:id/decision`, ...base, requireCapability('time_request.answer'), requests.decide); // R2
router.get(`${T}/requests/:id`, ...base, requireCapability('timesheet.read', 'time.own'), requests.detail); // R3 (its owner, or a reader in scope)
router.get(`${T}/me/requests`, ...base, requireCapability('time.own'), requests.mine); // R4 My requests
router.post(`${T}/me/requests`, ...base, requireCapability('time.own'), requests.create); // R5 Report a problem
router.post(`${T}/me/requests/:id/withdraw`, ...base, requireCapability('time.own'), requests.withdraw); // R6

router.get(`${T}/me/time`, ...base, requireCapability('time.own'), me.time); // M1
router.get(`${T}/me/rota`, ...base, requireCapability('time.own'), me.rota); // M2

export default router;
