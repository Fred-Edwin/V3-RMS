import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { deliveriesController, uploadPhotoFile } from './deliveries-controller';

/**
 * Deliveries (the branch), all under /inventory/deliveries (docs/features/inventory/dispatch-contract.md §4, V1 to V6).
 * Counting is the department rule in the service (an active member or the head of the receiving department, `deliveries.count`, held
 * by no role in the access table) and the Branch Manager counts and confirms for any department of the branch
 * (`deliveries.confirm_on_behalf`); never a new `requireRole` list, which is why a route here has `authenticate` only. NOTHING on V1
 * to V4 carries the sent figure; V5 is the one place it appears. The photo upload is multipart (5 MB, 3 per line).
 *   V1 GET /mine   V2 GET /:id/count   V3 PUT /:id/count and POST /:id/check
 *   V4 PUT /:id/lines/:lineId/reason, POST /:id/photos and DELETE /:id/photos/:photoId (Amendment 1 row 6)
 *   V5 GET /:id/confirm-preview   V6 POST /:id/confirm
 *   GET /photos/:photoId: the authenticated link a photo's `url` points at (bytes, not the envelope)
 * `/mine` and `/photos/...` sit BEFORE `/:id`, and `:id` only matches a uuid, so a literal path is never taken for an id.
 */
const router = Router();

router.use(authenticate);

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
router.param('id', (_req, _res, next, value: string) => (UUID.test(value) ? next() : next('route')));

router.get('/mine', deliveriesController.list); // V1
router.get('/photos/:photoId', deliveriesController.readPhoto);

router.get('/:id/count', deliveriesController.getCount); // V2
router.put('/:id/count', deliveriesController.saveCount); // V3
router.post('/:id/check', deliveriesController.check); // V3
router.put('/:id/lines/:lineId/reason', deliveriesController.setReason); // V4
router.post('/:id/photos', uploadPhotoFile, deliveriesController.uploadPhoto); // V4
router.delete('/:id/photos/:photoId', deliveriesController.deletePhoto); // V4
router.get('/:id/confirm-preview', deliveriesController.confirmPreview); // V5
router.post('/:id/confirm', deliveriesController.confirm); // V6

export default router;
