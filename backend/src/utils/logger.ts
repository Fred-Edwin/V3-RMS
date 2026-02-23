import pino from 'pino';
import { env } from '../config/env';

const isPrettyLoggingEnabled = env.NODE_ENV === 'development' && env.LOG_PRETTY;

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isPrettyLoggingEnabled
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            singleLine: true,
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});
