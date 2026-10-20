import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { attachWorkforceSubject } from '../people/people-subject';
import { leaveController as c } from './leave-controller';

/**
 * The Leave endpoints (Segment 4, spec section 12). Every route: authenticate, then attachWorkforceSubject (head rows), then the
 * capability; scope and the 404 versus 403 rule are checked in the services on the actual record. No requireRole anywhere.
 *   M1-M6 my leave: overview, list, detail, preview, ask, cancel · D1-D4 deciders: requests, rota strip, approve, decline
 *   B1-B3 balances and adjust · C1 calendar · S1-S2 the slip · N1 badge, needs-you, away
 */
const L = '/workforce/leave';
const router = Router();
const base = [authenticate, attachWorkforceSubject] as const;

router.get(`${L}/me/overview`, ...base, requireCapability('leave.request'), c.overview); // M1
router.get(`${L}/me/applications`, ...base, requireCapability('leave.request'), c.mine); // M2
router.post(`${L}/applications/preview`, ...base, requireCapability('leave.request'), c.preview); // M4
router.post(`${L}/applications`, ...base, requireCapability('leave.request'), c.ask); // M5
router.get(`${L}/applications/:id`, ...base, requireCapability('leave.request', 'leave.read'), c.detail); // M3 (its owner, or a reader in scope)
router.post(`${L}/applications/:id/cancel`, ...base, requireCapability('leave.request', 'leave.approve'), c.cancel); // M6
router.get(`${L}/requests`, ...base, requireCapability('leave.read'), c.requests); // D1
router.get(`${L}/applications/:id/rota`, ...base, requireCapability('leave.read'), c.rota); // D2
router.post(`${L}/applications/:id/approve`, ...base, requireCapability('leave.approve'), c.approve); // D3
router.post(`${L}/applications/:id/decline`, ...base, requireCapability('leave.approve'), c.decline); // D4
router.get(`${L}/balances`, ...base, requireCapability('leave.read'), c.balances); // B1
router.get(`${L}/balances/:employeeId`, ...base, requireCapability('leave.read'), c.drawer); // B2
router.post(`${L}/balances/adjust/preview`, ...base, requireCapability('leave.balance_adjust'), c.adjustPreview); // B3
router.post(`${L}/balances/adjust`, ...base, requireCapability('leave.balance_adjust'), c.adjust); // B3
router.get(`${L}/calendar`, ...base, requireCapability('leave.read'), c.calendar); // C1
router.get(`${L}/applications/:id/slip`, ...base, requireCapability('leave.request', 'leave.read'), c.slip); // S1
router.get(`${L}/applications/:id/slip.pdf`, ...base, requireCapability('leave.request', 'leave.read'), c.slipPdf); // S2
router.get(`${L}/badge`, ...base, requireCapability('leave.request'), c.badge); // N1
router.get(`${L}/needs-you`, ...base, requireCapability('leave.approve'), c.needsYou); // N1
router.get(`${L}/away`, ...base, requireCapability('leave.read'), c.away); // N1

export default router;
