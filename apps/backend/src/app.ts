import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { Request, Response } from 'express';
import helmet from 'helmet';

import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { ok } from './shared/responses/api-response.js';

type CreateAppOptions = {
  authRepository?: AuthRepository;
  disableRateLimits?: boolean;
};

export function createApp(options: CreateAppOptions = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestLogger);

  app.get('/health', (_request: Request, response: Response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.get('/api/v1/health', (_request: Request, response: Response) => {
    response.status(200).json(ok({ status: 'ok' }));
  });

  app.use('/api/v1/auth', createAuthRouter(options));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
