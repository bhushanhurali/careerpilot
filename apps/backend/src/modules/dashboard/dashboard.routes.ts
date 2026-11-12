import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

export function createDashboardRouter(): Router {
  const router = Router();
  const controller = new DashboardController(new DashboardService());

  router.get('/', authenticate, controller.get);

  return router;
}
