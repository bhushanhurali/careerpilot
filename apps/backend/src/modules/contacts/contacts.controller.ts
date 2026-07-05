import { RequestHandler } from 'express';

import { ok } from '../../shared/responses/api-response.js';
import {
  parseRequestBody,
  parseRequestParams,
  parseRequestQuery,
} from '../../shared/validation/parse-request.js';
import {
  contactDetailParamsSchema,
  contactListParamsSchema,
  createContactSchema,
  listContactsQuerySchema,
  updateContactSchema,
} from './contacts.schemas.js';
import { ContactsService } from './contacts.service.js';

export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  list: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const params = parseRequestParams(contactListParamsSchema, request.params);
      const query = parseRequestQuery(listContactsQuerySchema, request.query);
      const result = await this.contactsService.listContacts(auth.userId, params.companyId, query);

      response.status(200).json(ok({ contacts: result.contacts }, result.meta));
    } catch (error) {
      next(error);
    }
  };

  create: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const params = parseRequestParams(contactListParamsSchema, request.params);
      const body = parseRequestBody(createContactSchema, request.body);
      const contact = await this.contactsService.createContact(auth.userId, params.companyId, body);

      response.status(201).json(ok({ contact }));
    } catch (error) {
      next(error);
    }
  };

  get: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const params = parseRequestParams(contactDetailParamsSchema, request.params);
      const contact = await this.contactsService.getContact(
        auth.userId,
        params.companyId,
        params.contactId,
      );

      response.status(200).json(ok({ contact }));
    } catch (error) {
      next(error);
    }
  };

  update: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const params = parseRequestParams(contactDetailParamsSchema, request.params);
      const body = parseRequestBody(updateContactSchema, request.body);
      const contact = await this.contactsService.updateContact(
        auth.userId,
        params.companyId,
        params.contactId,
        body,
      );

      response.status(200).json(ok({ contact }));
    } catch (error) {
      next(error);
    }
  };

  delete: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const params = parseRequestParams(contactDetailParamsSchema, request.params);
      await this.contactsService.deleteContact(auth.userId, params.companyId, params.contactId);

      response.status(200).json(ok({ deleted: true }));
    } catch (error) {
      next(error);
    }
  };

  private getAuth(request: Parameters<RequestHandler>[0]) {
    if (!request.auth) {
      throw new Error('Authentication middleware did not attach auth context');
    }

    return request.auth;
  }
}
