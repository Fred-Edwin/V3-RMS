import 'dotenv/config';
import { initSentry } from './config/sentry';
initSentry();
import { createServer } from 'http';
import { app } from './app';
import { env } from './config/env';
import { inventoryBadgesBridge } from './sockets/inventory-badges-bridge';
import { createSocketServer } from './sockets/socket';
import { emitInventoryBadgesLocal } from './sockets/socket-service';
import { startRequisitionNotices } from './modules/inventory/requisitions/requisitions-notices';
import { logger } from './utils/logger';

const httpServer = createServer(app);
createSocketServer(httpServer);
// A nudge started in another process (the worker's urgent escalation) reaches this process's browsers through Redis.
void inventoryBadgesBridge.start(emitInventoryBadgesLocal).catch((error: unknown) => {
  logger.error({ error }, 'Could not listen for inventory badge nudges from other processes');
});
// The requisition writes publish a notice after commit; the notification layer (push, badge nudge) listens from here on.
startRequisitionNotices();

if (process.env.START_BULLMQ_WORKERS === 'true') {
  void import('./jobs/workers')
    .then(({ startWorkers }) => {
      startWorkers();
    })
    .catch((error: unknown) => {
      logger.error({ error }, 'Failed to load BullMQ workers');
    });
}

httpServer.listen(env.PORT, () => {
  logger.info(`Backend server is running on port ${env.PORT}`);
});
