import { RequestHandler } from 'express';

import { ok } from '../../shared/responses/api-response.js';
import {
  parseRequestBody,
  parseRequestParams,
  parseRequestQuery,
} from '../../shared/validation/parse-request.js';
import { ApplicationsService } from './applications.service.js';
import {
  applicationIdParamsSchema,
  createApplicationSchema,
  createStatusTransitionSchema,
  listApplicationsQuerySchema,
  updateApplicationSchema,
} from './applications.schemas.js';

export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  list: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const query = parseRequestQuery(listApplicationsQuerySchema, request.query);
      const result = await this.applicationsService.listApplications(auth.userId, query);

      response.status(200).json(ok({ applications: result.applications }, result.meta));
    } catch (error) {
      next(error);
    }
  };

  create: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const body = parseRequestBody(createApplicationSchema, request.body);
      const application = await this.applicationsService.createApplication(auth.userId, body);

      response.status(201).json(ok({ application }));
    } catch (error) {
      next(error);
    }
  };

  get: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const params = parseRequestParams(applicationIdParamsSchema, request.params);
      const application = await this.applicationsService.getApplication(
        auth.userId,
        params.applicationId,
      );

      response.status(200).json(ok({ application }));
    } catch (error) {
      next(error);
    }
  };

  listStatusHistory: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const params = parseRequestParams(applicationIdParamsSchema, request.params);
      const statusHistory = await this.applicationsService.listStatusHistory(
        auth.userId,
        params.applicationId,
      );

      response.status(200).json(ok({ statusHistory }));
    } catch (error) {
      next(error);
    }
  };

  createStatusTransition: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const params = parseRequestParams(applicationIdParamsSchema, request.params);
      const body = parseRequestBody(createStatusTransitionSchema, request.body);
      const result = await this.applicationsService.createStatusTransition(
        auth.userId,
        params.applicationId,
        body,
      );

      response.status(201).json(ok(result));
    } catch (error) {
      next(error);
    }
  };

  update: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const params = parseRequestParams(applicationIdParamsSchema, request.params);
      const body = parseRequestBody(updateApplicationSchema, request.body);
      const application = await this.applicationsService.updateApplication(
        auth.userId,
        params.applicationId,
        body,
      );

      response.status(200).json(ok({ application }));
    } catch (error) {
      next(error);
    }
  };

  delete: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const params = parseRequestParams(applicationIdParamsSchema, request.params);
      await this.applicationsService.deleteApplication(auth.userId, params.applicationId);

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
