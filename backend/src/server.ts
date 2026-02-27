import 'dotenv/config';
import { createServer } from 'http';
import { app } from './app';
import { env } from './config/env';
import { createSocketServer } from './sockets/socket';
import { logger } from './utils/logger';

const httpServer = createServer(app);
createSocketServer(httpServer);

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
