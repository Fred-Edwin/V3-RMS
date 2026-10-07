import { Router } from 'express';

/**
 * Counting, `record/`: taking a count (C8 start options, C9 start, C10 save numbers, C11 section-end check, C12 sign preview,
 * C13 sign, C14 the Attendant's order for today). Placeholder landed by the orchestrator; the counting back-end session
 * builds the routes here (docs/sessions/stock-count-waste-be-counting.md). Register the literal paths
 * (`/counts/start-options`, `/counts/section-order/today`) before any `/counts/:id/...` path.
 */
const router = Router();

export default router;
