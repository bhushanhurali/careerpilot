import { RequestHandler, Router } from 'express';
import { z } from 'zod';

import { authenticate } from '../../middleware/authenticate.js';
import { validateBody } from '../../shared/validation/validate-request.js';
import { AuthController } from './auth.controller.js';
import { loginRateLimit, refreshRateLimit, registerRateLimit } from './auth.rate-limit.js';
import { AuthRepository, SequelizeAuthRepository } from './auth.repository.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import { AuthService } from './auth.service.js';

type AuthRouterOptions = {
  authRepository?: AuthRepository;
  disableRateLimits?: boolean;
};

const emptyBodySchema = z.object({}).strict();

export function createAuthRouter(options: AuthRouterOptions = {}): Router {
  const router = Router();
  const authService = new AuthService(options.authRepository ?? new SequelizeAuthRepository());
  const authController = new AuthController(authService);

  const maybeRateLimit = (middleware: RequestHandler): RequestHandler[] =>
    options.disableRateLimits ? [] : [middleware];

  router.post(
    '/register',
    ...maybeRateLimit(registerRateLimit),
    validateBody(registerSchema),
    authController.register,
  );
  router.post(
    '/login',
    ...maybeRateLimit(loginRateLimit),
    validateBody(loginSchema),
    authController.login,
  );
  router.post('/refresh', ...maybeRateLimit(refreshRateLimit), authController.refresh);
  router.post('/logout', validateBody(emptyBodySchema), authController.logout);
  router.get('/me', authenticate, authController.me);

  return router;
}
