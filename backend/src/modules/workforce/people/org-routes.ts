import { Router } from 'express';

/**
 * The Organisation endpoints (O1 to O9) and the positions endpoints belong to slice 1b. The router is mounted now so
 * `routes/index.ts` does not change again; until 1b it has no routes.
 */
const router = Router();

export default router;
