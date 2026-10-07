import { Router } from 'express';

/**
 * Stock, `history/`: the Stock ledger (S3), its CSV export (S4) and one item's Stock card (S5). Placeholder landed by the
 * orchestrator; the stock and waste back-end session builds the routes here
 * (docs/sessions/stock-count-waste-be-stock-waste.md). Register `/ledger/export` before `/ledger/:itemId`. This folder is
 * the screens' history of movements; `stock/ledger/` (the door that posts them) is a different thing and is not touched here.
 */
const router = Router();

export default router;
