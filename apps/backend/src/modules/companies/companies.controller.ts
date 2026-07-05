import { RequestHandler } from 'express';

import { ok } from '../../shared/responses/api-response.js';
import {
  parseRequestBody,
  parseRequestParams,
  parseRequestQuery,
} from '../../shared/validation/parse-request.js';
import { CompaniesService } from './companies.service.js';
import {
  companyIdParamsSchema,
  createCompanySchema,
  listCompaniesQuerySchema,
  updateCompanySchema,
} from './companies.schemas.js';

export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  list: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const query = parseRequestQuery(listCompaniesQuerySchema, request.query);
      const result = await this.companiesService.listCompanies(auth.userId, query);

      response.status(200).json(ok({ companies: result.companies }, result.meta));
    } catch (error) {
      next(error);
    }
  };

  create: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const body = parseRequestBody(createCompanySchema, request.body);
      const company = await this.companiesService.createCompany(auth.userId, body);

      response.status(201).json(ok({ company }));
    } catch (error) {
      next(error);
    }
  };

  get: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const params = parseRequestParams(companyIdParamsSchema, request.params);
      const company = await this.companiesService.getCompany(auth.userId, params.companyId);

      response.status(200).json(ok({ company }));
    } catch (error) {
      next(error);
    }
  };

  update: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const params = parseRequestParams(companyIdParamsSchema, request.params);
      const body = parseRequestBody(updateCompanySchema, request.body);
      const company = await this.companiesService.updateCompany(
        auth.userId,
        params.companyId,
        body,
      );

      response.status(200).json(ok({ company }));
    } catch (error) {
      next(error);
    }
  };

  delete: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const params = parseRequestParams(companyIdParamsSchema, request.params);
      await this.companiesService.deleteCompany(auth.userId, params.companyId);

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
