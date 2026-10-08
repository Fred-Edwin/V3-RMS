import 'dotenv/config';
import { initSentry } from './config/sentry';
initSentry();
import { createServer } from 'http';
import { app } from './app';
import { env } from './config/env';
import { createSocketServer } from './sockets/socket';
import { startRequisitionNotices } from './modules/inventory/requisitions/requisitions-notices';
import { logger } from './utils/logger';

const httpServer = createServer(app);
createSocketServer(httpServer);
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
