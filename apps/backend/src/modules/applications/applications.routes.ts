import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { validateBody } from '../../shared/validation/validate-request.js';
import { ApplicationsController } from './applications.controller.js';
import { createApplicationSchema, updateApplicationSchema } from './applications.schemas.js';
import { ApplicationsService } from './applications.service.js';

export function createApplicationsRouter(): Router {
  const router = Router();
  const applicationsController = new ApplicationsController(new ApplicationsService());

  router.use(authenticate);

  router.get('/', applicationsController.list);
  router.post('/', validateBody(createApplicationSchema), applicationsController.create);
  router.get('/:applicationId', applicationsController.get);
  router.patch(
    '/:applicationId',
    validateBody(updateApplicationSchema),
    applicationsController.update,
  );
  router.delete('/:applicationId', applicationsController.delete);

  return router;
}
