import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { validateBody } from '../../shared/validation/validate-request.js';
import { TasksController } from './tasks.controller.js';
import { createTaskSchema, updateTaskSchema } from './tasks.schemas.js';
import { TasksService } from './tasks.service.js';

export function createTasksRouter(): Router {
  const router = Router();
  const controller = new TasksController(new TasksService());

  router.get('/', authenticate, controller.list);

  return router;
}

export function createApplicationTasksRouter(): Router {
  const router = Router({ mergeParams: true });
  const controller = new TasksController(new TasksService());

  router.get('/', controller.listForApplication);
  router.post('/', validateBody(createTaskSchema), controller.create);
  router.get('/:taskId', controller.get);
  router.patch('/:taskId', validateBody(updateTaskSchema), controller.update);
  router.delete('/:taskId', controller.delete);

  return router;
}
