import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

export function createNotificationsRouter(): Router {
  const router = Router();
  const controller = new NotificationsController(new NotificationsService());

  router.use(authenticate);
  router.use((_request, response, next) => {
    response.set('Cache-Control', 'private, no-store');
    next();
  });
  router.get('/', controller.list);
  router.patch('/:notificationId/read', controller.markAsRead);

  return router;
}
