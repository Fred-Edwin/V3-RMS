import 'dotenv/config';
import { createServer } from 'http';
import { app } from './app';
import { env } from './config/env';
import { createSocketServer } from './sockets/socket';
import { startWorkers } from './jobs/workers';
import { logger } from './utils/logger';

const httpServer = createServer(app);
createSocketServer(httpServer);
startWorkers();

httpServer.listen(env.PORT, () => {
  logger.info(`Backend server is running on port ${env.PORT}`);
});
