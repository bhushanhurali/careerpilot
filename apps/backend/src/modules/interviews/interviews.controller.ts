import { RequestHandler } from 'express';

import { ok } from '../../shared/responses/api-response.js';
import { parseRequestBody, parseRequestParams } from '../../shared/validation/parse-request.js';
import { applicationIdParamsSchema } from '../applications/applications.schemas.js';
import {
  createInterviewSchema,
  interviewDetailParamsSchema,
  updateInterviewSchema,
} from './interviews.schemas.js';
import { InterviewsService } from './interviews.service.js';

export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  list: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const { applicationId } = parseRequestParams(applicationIdParamsSchema, request.params);
      const interviews = await this.interviewsService.listInterviews(auth.userId, applicationId);

      response.status(200).json(ok({ interviews }));
    } catch (error) {
      next(error);
    }
  };

  create: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const { applicationId } = parseRequestParams(applicationIdParamsSchema, request.params);
      const body = parseRequestBody(createInterviewSchema, request.body);
      const interview = await this.interviewsService.createInterview(
        auth.userId,
        applicationId,
        body,
      );

      response.status(201).json(ok({ interview }));
    } catch (error) {
      next(error);
    }
  };

  update: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const { applicationId, interviewId } = parseRequestParams(
        interviewDetailParamsSchema,
        request.params,
      );
      const body = parseRequestBody(updateInterviewSchema, request.body);
      const interview = await this.interviewsService.updateInterview(
        auth.userId,
        applicationId,
        interviewId,
        body,
      );

      response.status(200).json(ok({ interview }));
    } catch (error) {
      next(error);
    }
  };

  delete: RequestHandler = async (request, response, next) => {
    try {
      const auth = this.getAuth(request);
      const { applicationId, interviewId } = parseRequestParams(
        interviewDetailParamsSchema,
        request.params,
      );
      await this.interviewsService.deleteInterview(auth.userId, applicationId, interviewId);

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
