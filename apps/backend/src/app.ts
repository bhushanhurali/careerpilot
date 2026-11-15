import { BlockList, isIP } from 'node:net';

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
import { createApplicationsRouter } from './modules/applications/applications.routes.js';
import { createCompaniesRouter } from './modules/companies/companies.routes.js';
import { createDashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { createNotificationsRouter } from './modules/notifications/notifications.routes.js';
import { createResumesRouter } from './modules/resumes/resume.routes.js';
import { createTasksRouter } from './modules/tasks/tasks.routes.js';
import { ok } from './shared/responses/api-response.js';
import { verifyReadiness } from './readiness.js';

type CreateAppOptions = {
  authRepository?: AuthRepository;
  disableRateLimits?: boolean;
};

export function createApp(options: CreateAppOptions = {}) {
  const app = express();
  if (env.NODE_ENV === 'production' && env.TRUSTED_PROXY_IP) {
    const proxy = new BlockList();
    proxy.addAddress(env.TRUSTED_PROXY_IP, isIP(env.TRUSTED_PROXY_IP) === 6 ? 'ipv6' : 'ipv4');
    app.set(
      'trust proxy',
      (address: string, hop: number) =>
        hop === 0 && proxy.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4'),
    );
  }

  app.use('/api/v1', (_request, response, next) => {
    response.set('Cache-Control', 'private, no-store');
    next();
  });
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => callback(null, origin === env.CORS_ORIGIN),
      credentials: true,
    }),
  );
  app.use(requestLogger);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', (_request: Request, response: Response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.get('/ready', async (_request, response) => {
    response.set('Cache-Control', 'no-store');
    try {
      await verifyReadiness();
      response.status(200).json({ status: 'ready' });
    } catch {
      response.status(503).json({ status: 'not_ready' });
    }
  });

  app.get('/api/v1/health', (_request: Request, response: Response) => {
    response.status(200).json(ok({ status: 'ok' }));
  });

  app.use('/api/v1/auth', createAuthRouter(options));
  app.use('/api/v1/applications', createApplicationsRouter());
  app.use('/api/v1/companies', createCompaniesRouter());
  app.use('/api/v1/dashboard', createDashboardRouter());
  app.use('/api/v1/notifications', createNotificationsRouter());
  app.use('/api/v1/resumes', createResumesRouter());
  app.use('/api/v1/tasks', createTasksRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
