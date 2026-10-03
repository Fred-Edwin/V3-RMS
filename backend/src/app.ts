import express from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import apiRouter from './routes';
import { env } from './config/env';
import { requestLogger } from './middleware/request-logger';
import { notFound } from './middleware/not-found';
import { errorHandler } from './middleware/error-handler';
import { wireNames } from './middleware/wire-names';

export const app = express();

app.use(requestLogger);
app.use(express.json());
app.use(compression());
app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
  }),
);
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use(wireNames);
app.use(env.API_PREFIX, apiRouter);
app.use(notFound);
app.use(errorHandler);
