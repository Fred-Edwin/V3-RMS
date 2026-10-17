import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { orgController as c } from './organisation/org-controller';
import { attachWorkforceSubject } from './people-subject';

/**
 * The Organisation endpoints (O1 to O15). Every route: authenticate, then attachWorkforceSubject (head rows), then the
 * capability; scope is checked in the service on the actual record. Static paths come before `/:id`.
 */
const router = Router();
const base = [authenticate, attachWorkforceSubject] as const;
const O = '/workforce/org';

router.get(O, ...base, requireCapability('org.read'), c.overview); // O1
router.get(`${O}/positions`, ...base, requireCapability('org.read'), c.positions); // O10
router.post(`${O}/positions`, ...base, requireCapability('org.write'), c.createPosition); // O12
router.get(`${O}/positions/:id`, ...base, requireCapability('org.read'), c.position); // O11
router.get(`${O}/positions/:id/impact`, ...base, requireCapability('org.write'), c.positionImpact); // O13
router.patch(`${O}/positions/:id`, ...base, requireCapability('org.write'), c.updatePosition); // O14
router.post(`${O}/positions/:id/retire`, ...base, requireCapability('org.write'), c.retirePosition); // O15
router.post(`${O}/positions/:id/restore`, ...base, requireCapability('org.write'), c.restorePosition); // O15

router.post(`${O}/departments`, ...base, requireCapability('org.write'), c.createDepartment); // O3
router.get(`${O}/departments/:id`, ...base, requireCapability('org.read'), c.department); // O2
router.patch(`${O}/departments/:id`, ...base, requireCapability('org.write'), c.updateDepartment); // O4
router.post(`${O}/departments/:id/retire`, ...base, requireCapability('org.write'), c.retireDepartment); // O5
router.post(`${O}/departments/:id/restore`, ...base, requireCapability('org.write'), c.restoreDepartment); // O5
router.get(`${O}/departments/:id/head-candidates`, ...base, requireCapability('org.write_heads'), c.headCandidates); // O6
router.post(`${O}/departments/:id/head/preview`, ...base, requireCapability('org.write_heads'), c.previewHead); // O7
router.post(`${O}/departments/:id/head/end`, ...base, requireCapability('org.write_heads'), c.endHead); // O9
router.post(`${O}/departments/:id/head`, ...base, requireCapability('org.write_heads'), c.assignHead); // O8

export default router;
