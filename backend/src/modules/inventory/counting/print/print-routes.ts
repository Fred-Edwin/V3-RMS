import { Router } from 'express';

/**
 * Counting, `print/`: the data for the two A4 pages (C6 the signed count record, C7 the blank count sheet). Placeholder
 * landed by the orchestrator; the counting back-end session builds the routes here
 * (docs/sessions/stock-count-waste-be-counting.md). `/counts/blank-sheet` must not be shadowed by `/counts/:id`.
 */
const router = Router();

export default router;
