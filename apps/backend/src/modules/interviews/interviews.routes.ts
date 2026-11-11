import { Router } from 'express';

import { validateBody } from '../../shared/validation/validate-request.js';
import { InterviewsController } from './interviews.controller.js';
import { createInterviewSchema, updateInterviewSchema } from './interviews.schemas.js';
import { InterviewsService } from './interviews.service.js';

export function createInterviewsRouter(): Router {
  const router = Router({ mergeParams: true });
  const interviewsController = new InterviewsController(new InterviewsService());

  router.get('/', interviewsController.list);
  router.post('/', validateBody(createInterviewSchema), interviewsController.create);
  router.patch('/:interviewId', validateBody(updateInterviewSchema), interviewsController.update);
  router.delete('/:interviewId', interviewsController.delete);

  return router;
}
