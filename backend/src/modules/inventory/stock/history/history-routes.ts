import { Router } from 'express';
import { authenticate } from '../../../../middleware/authenticate';
import { requireCapability } from '../../_shared/central-store-access';
import { historyController } from './history-controller';

/**
 * Stock, `history/`: the Stock ledger (S3), its CSV export (S4) and one item's Stock card (S5), all `stock.read`.
 * `/ledger/export` is registered before `/ledger/:itemId`, or "export" would be read as an item id. This folder is the
 * screens' history of movements; `stock/ledger/` (the door that posts them) is a different thing.
 */
const router = Router();

router.use(authenticate);

router.get('/ledger', requireCapability('stock.read'), historyController.list);
router.get('/ledger/export', requireCapability('stock.read'), historyController.exportCsv);
router.get('/ledger/:itemId', requireCapability('stock.read'), historyController.card);

export default router;
