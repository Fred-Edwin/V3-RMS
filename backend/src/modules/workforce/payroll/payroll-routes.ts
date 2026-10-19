import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { attachWorkforceSubject } from '../people/people-subject';
import { approvalController as approval } from './approval/approval-controller';
import { monthsController as months } from './months/months-controller';
import { reviewController as review } from './review/review-controller';
import { sitesController as sites } from './sites/sites-controller';

/**
 * The Payroll endpoints (Segment 2A: the month, the engine, the review and the approval). Every route: authenticate, then
 * attachWorkforceSubject, then the capability; the service checks the state and the version. There is no requireRole in this module.
 * Part 2 adds publish, corrections, the bank file, Mark as paid and the exports.
 *   P1 months list · P2 a month · P3-P6 its tabs · P7 payslips · P8 one payslip · P9 the estimate · P10 review
 *   P11 recalculate · P12-P14 tick, tick a kind, leave out · P15-P16 add and remove a line · P17 send · P18 send back · P19 approve
 *   P20 remind a site · P21 the Director approves for a site
 */
const P = '/workforce/payroll';
const router = Router();
const base = [authenticate, attachWorkforceSubject] as const;
const M = `${P}/months/:monthKey`;

router.get(`${P}/months`, ...base, requireCapability('payroll.read'), months.list); // P1
router.get(M, ...base, requireCapability('payroll.read'), months.get); // P2
router.get(`${M}/rules-applied`, ...base, requireCapability('payroll.read'), months.rulesApplied); // P3
router.get(`${M}/tax`, ...base, requireCapability('payroll.read'), months.tax); // P4
router.get(`${M}/casual`, ...base, requireCapability('payroll.read'), months.casual); // P5
router.get(`${M}/totals`, ...base, requireCapability('payroll.read'), months.totals); // P6
router.get(`${M}/payslips`, ...base, requireCapability('payroll.read'), months.payslips); // P7
router.get(`${M}/payslips/:payslipId`, ...base, requireCapability('payroll.read'), months.payslip); // P8
router.get(`${M}/estimate`, ...base, requireCapability('payroll.estimate.read'), months.estimate); // P9

router.get(`${M}/review`, ...base, requireCapability('payroll.read'), review.list); // P10
router.post(`${M}/recalculate`, ...base, requireCapability('payroll.review'), review.recalculate); // P11
router.post(`${M}/review/check-kind`, ...base, requireCapability('payroll.review'), review.checkKind); // P13
router.post(`${M}/review/:lineId/check`, ...base, requireCapability('payroll.review'), review.check); // P12
router.post(`${M}/review/:lineId/leave-out`, ...base, requireCapability('payroll.review'), review.leaveOut); // P14
router.post(`${M}/adjustments`, ...base, requireCapability('payroll.review'), review.addAdjustment); // P15
router.delete(`${M}/adjustments/:id`, ...base, requireCapability('payroll.review'), review.removeAdjustment); // P16

router.post(`${M}/send-to-accountant`, ...base, requireCapability('payroll.review'), approval.send); // P17
router.post(`${M}/send-back`, ...base, requireCapability('payroll.approve'), approval.sendBack); // P18
router.post(`${M}/approve`, ...base, requireCapability('payroll.approve'), approval.approve); // P19

router.post(`${M}/sites/:siteId/remind`, ...base, requireCapability('payroll.remind'), sites.remind); // P20
router.post(`${M}/sites/:siteId/approve-late`, ...base, requireCapability('payroll.approve_site_late'), sites.approveLate); // P21

export default router;
