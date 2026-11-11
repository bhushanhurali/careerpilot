import { RequestHandler } from 'express';

import { ok } from '../../shared/responses/api-response.js';
import {
  parseRequestBody,
  parseRequestParams,
  parseRequestQuery,
} from '../../shared/validation/parse-request.js';
import { applicationIdParamsSchema } from '../applications/applications.schemas.js';
import {
  createTaskSchema,
  listTasksQuerySchema,
  taskDetailParamsSchema,
  updateTaskSchema,
} from './tasks.schemas.js';
import { TasksService } from './tasks.service.js';

export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  list: RequestHandler = async (request, response) => {
    const auth = this.getAuth(request);
    const query = parseRequestQuery(listTasksQuerySchema, request.query);
    const { tasks, meta } = await this.tasksService.listTasks(auth.userId, query);

    response.status(200).json(ok({ tasks }, meta));
  };

  listForApplication: RequestHandler = async (request, response) => {
    const auth = this.getAuth(request);
    const { applicationId } = parseRequestParams(applicationIdParamsSchema, request.params);
    const tasks = await this.tasksService.listApplicationTasks(auth.userId, applicationId);

    response.status(200).json(ok({ tasks }));
  };

  get: RequestHandler = async (request, response) => {
    const auth = this.getAuth(request);
    const { applicationId, taskId } = parseRequestParams(taskDetailParamsSchema, request.params);
    const task = await this.tasksService.getTask(auth.userId, applicationId, taskId);

    response.status(200).json(ok({ task }));
  };

  create: RequestHandler = async (request, response) => {
    const auth = this.getAuth(request);
    const { applicationId } = parseRequestParams(applicationIdParamsSchema, request.params);
    const body = parseRequestBody(createTaskSchema, request.body);
    const task = await this.tasksService.createTask(auth.userId, applicationId, body);

    response.status(201).json(ok({ task }));
  };

  update: RequestHandler = async (request, response) => {
    const auth = this.getAuth(request);
    const { applicationId, taskId } = parseRequestParams(taskDetailParamsSchema, request.params);
    const body = parseRequestBody(updateTaskSchema, request.body);
    const task = await this.tasksService.updateTask(auth.userId, applicationId, taskId, body);

    response.status(200).json(ok({ task }));
  };

  delete: RequestHandler = async (request, response) => {
    const auth = this.getAuth(request);
    const { applicationId, taskId } = parseRequestParams(taskDetailParamsSchema, request.params);
    await this.tasksService.deleteTask(auth.userId, applicationId, taskId);

    response.status(200).json(ok({ deleted: true }));
  };

  private getAuth(request: Parameters<RequestHandler>[0]) {
    if (!request.auth) {
      throw new Error('Authentication middleware did not attach auth context');
    }

    return request.auth;
  }
}
