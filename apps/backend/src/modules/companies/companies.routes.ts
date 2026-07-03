import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { validateBody } from '../../shared/validation/validate-request.js';
import { CompaniesController } from './companies.controller.js';
import { createCompanySchema, updateCompanySchema } from './companies.schemas.js';
import { CompaniesService } from './companies.service.js';

export function createCompaniesRouter(): Router {
  const router = Router();
  const companiesController = new CompaniesController(new CompaniesService());

  router.use(authenticate);

  router.get('/', companiesController.list);
  router.post('/', validateBody(createCompanySchema), companiesController.create);
  router.get('/:companyId', companiesController.get);
  router.patch('/:companyId', validateBody(updateCompanySchema), companiesController.update);
  router.delete('/:companyId', companiesController.delete);

  return router;
}
