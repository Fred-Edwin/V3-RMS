import { Router } from 'express';
import { authenticate } from '../../../middleware/authenticate';
import { requireCapability } from '../_shared/central-store-access';
import { discrepanciesController } from './discrepancies-controller';

/**
 * Discrepancies, all under /inventory/discrepancies (docs/features/inventory/dispatch-contract.md §4, Q1 to Q5).
 * Each write gates itself with `requireCapability(...)` from `_shared/central-store-access.ts` (never a new `requireRole` list). The two
 * reads have `authenticate` only, because `discrepancies.read` is narrowed in the service: the hub desktop roles read everything, the
 * Branch Manager their own branch, and a department head (who holds nothing from the table) their own department.
 *   Q1 GET / (discrepancies.read)   Q2 GET /:id (discrepancies.read)   Q3 GET /:id/finding-preview?finding= (discrepancies.record)
 *   Q4 POST /:id/findings (discrepancies.record)   Q5 POST /:id/reverse (discrepancies.reverse)
 * `:id` only matches a uuid, so a literal path is never taken for an id.
 */
const router = Router();

router.use(authenticate);

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
router.param('id', (_req, _res, next, value: string) => (UUID.test(value) ? next() : next('route')));

router.get('/', discrepanciesController.list); // Q1
router.get('/:id/finding-preview', requireCapability('discrepancies.record'), discrepanciesController.findingPreview); // Q3
router.post('/:id/findings', requireCapability('discrepancies.record'), discrepanciesController.recordFinding); // Q4
router.post('/:id/reverse', requireCapability('discrepancies.reverse'), discrepanciesController.reverse); // Q5
router.get('/:id', discrepanciesController.getFile); // Q2

export default router;
