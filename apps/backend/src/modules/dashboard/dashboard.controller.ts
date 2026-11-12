import { RequestHandler } from 'express';

import { ok } from '../../shared/responses/api-response.js';
import { parseRequestQuery } from '../../shared/validation/parse-request.js';
import { dashboardQuerySchema } from './dashboard.schemas.js';
import { DashboardService } from './dashboard.service.js';

export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  get: RequestHandler = async (request, response) => {
    if (!request.auth) {
      throw new Error('Authentication middleware did not attach auth context');
    }

    const { today } = parseRequestQuery(dashboardQuerySchema, request.query);
    const dashboard = await this.service.getDashboard(request.auth.userId, today);

    response.status(200).json(ok(dashboard));
  };
}
