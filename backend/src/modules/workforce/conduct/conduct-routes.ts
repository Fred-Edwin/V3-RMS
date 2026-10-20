import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { attachWorkforceSubject } from '../people/people-subject';
import { appealsController as appeals } from './appeals/appeals-controller';
import { documentsController as documents } from './documents/documents-controller';
import { noticesController as notices } from './notices/notices-controller';

/**
 * The Conduct endpoints (Segment 5). Every route: authenticate, attachWorkforceSubject, the capability; the scope is checked in the
 * service on the actual notice (outside the caller's reach is 404, in reach but not allowed is 403). No requireRole in the module.
 * Fixed paths come before `/:id` so `me`, `badge`, `people` and `draft` are never read as an id.
 *   Staff: me · sign · appeal · witness card and answer · badge     Managers and HR: list · people · draft · preview · issue · detail
 *   not-signed · witness options · document · file tab     HR and Director: decision and its preview
 */
const C = '/workforce/conduct';
const router = Router();
const base = [authenticate, attachWorkforceSubject] as const;

router.get(`${C}/me`, ...base, requireCapability('discipline.read_own'), notices.me);
router.get(`${C}/badge`, ...base, requireCapability('discipline.read_own'), notices.badge);
router.get(C, ...base, requireCapability('discipline.read'), notices.list);
router.get(`${C}/people`, ...base, requireCapability('discipline.issue'), notices.people);
router.get(`${C}/draft`, ...base, requireCapability('discipline.issue'), notices.draft);
router.post(`${C}/draft/preview`, ...base, requireCapability('discipline.issue'), documents.preview);
router.post(C, ...base, requireCapability('discipline.issue'), notices.issue);

router.get(`${C}/:id`, ...base, requireCapability('discipline.read', 'discipline.read_own'), notices.detail);
router.get(`${C}/:id/document`, ...base, requireCapability('discipline.read', 'discipline.read_own'), documents.document);
router.post(`${C}/:id/sign`, ...base, requireCapability('discipline.read_own'), notices.sign);
router.post(`${C}/:id/appeal`, ...base, requireCapability('discipline.read_own'), appeals.appeal);
router.post(`${C}/:id/not-signed`, ...base, requireCapability('discipline.issue'), notices.notSigned);
router.get(`${C}/:id/witness-options`, ...base, requireCapability('discipline.issue'), notices.witnessOptions);
router.get(`${C}/:id/witness`, ...base, requireCapability('notifications.own'), notices.witnessCard);
router.post(`${C}/:id/witness`, ...base, requireCapability('notifications.own'), notices.witness);
router.post(`${C}/:id/decision`, ...base, requireCapability('discipline.decide'), appeals.decision);
router.post(`${C}/:id/decision/preview`, ...base, requireCapability('discipline.decide'), appeals.preview);

router.get('/workforce/people/:id/conduct', ...base, requireCapability('discipline.read'), notices.file);

export default router;
