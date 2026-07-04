import { Router } from 'express';

import { validateBody } from '../../shared/validation/validate-request.js';
import { ContactsController } from './contacts.controller.js';
import { createContactSchema, updateContactSchema } from './contacts.schemas.js';
import { ContactsService } from './contacts.service.js';

export function createContactsRouter(): Router {
  const router = Router({ mergeParams: true });
  const contactsController = new ContactsController(new ContactsService());

  router.get('/', contactsController.list);
  router.post('/', validateBody(createContactSchema), contactsController.create);
  router.get('/:contactId', contactsController.get);
  router.patch('/:contactId', validateBody(updateContactSchema), contactsController.update);
  router.delete('/:contactId', contactsController.delete);

  return router;
}
