import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { attachWorkforceSubject } from '../people/people-subject';
import { securityController as c } from './security-controller';

/**
 * Phones, alerts, "This wasn't me" and the password reset (6a S1 to S4). Phones are own-only (the person comes from the token).
 * `reset-password` and `state` take no capability: they are what a person with the reset flag raised can still reach (the session gate).
 */
const P = '/workforce/security';
const router = Router();
const signedIn = [authenticate, attachWorkforceSubject] as const;
const phones = [...signedIn, requireCapability('security.phones.own')] as const;
const read = [...signedIn, requireCapability('security.alerts.read')] as const;
const clear = [...signedIn, requireCapability('security.alerts.clear')] as const;

router.get(`${P}/phones/me`, ...phones, c.phones);
router.post(`${P}/phones/me/current/seen`, ...phones, c.seen);
router.post(`${P}/phones/me/current/answer`, ...phones, c.answer);
router.post(`${P}/phones/me/:id/confirm`, ...phones, c.confirm);
router.post(`${P}/phones/me/:id/remove`, ...phones, c.remove);

router.get(`${P}/alerts`, ...read, c.alerts);
router.get(`${P}/alerts/counts`, ...read, c.counts);
router.post(`${P}/alerts/start`, ...clear, c.start);
router.post(`${P}/alerts/:id/clear`, ...clear, c.clear);

router.post(`${P}/wasnt-me`, ...phones, c.wasntMe);
router.post(`${P}/reset-password`, ...signedIn, c.reset);
router.get(`${P}/state`, ...signedIn, c.state);

export default router;
