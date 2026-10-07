import { Router } from 'express';

/**
 * Counting, `settings/`: Count settings (C23 read, C24 what-if preview, C25 range and repeat-shortfall flag, C26 the Director
 * alert amount). Placeholder landed by the orchestrator; the counting back-end session builds the routes here
 * (docs/sessions/stock-count-waste-be-counting.md).
 */
const router = Router();

export default router;
