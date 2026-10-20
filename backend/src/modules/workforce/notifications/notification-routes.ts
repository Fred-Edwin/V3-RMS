import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/workforce-access';
import { attachWorkforceSubject } from '../people/people-subject';
import { notificationController as c } from './notification-controller';

/** The Notifications tab of the Inbox (6b N6). Own rows only: the person comes from the token, never from the URL. */
const P = '/workforce/notifications';
const router = Router();
const mine = [authenticate, attachWorkforceSubject, requireCapability('notifications.own')] as const;

router.get(P, ...mine, c.list);
router.get(`${P}/unread-count`, ...mine, c.unreadCount);
router.post(`${P}/read`, ...mine, c.read);
router.post(`${P}/read-all`, ...mine, c.readAll);

export default router;
