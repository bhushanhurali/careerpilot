import type { Request, RequestHandler } from 'express';

import { ok } from '../../shared/responses/api-response.js';
import { parseRequestParams, parseRequestQuery } from '../../shared/validation/parse-request.js';
import { notificationIdParams, notificationListQuery } from './notifications.schemas.js';
import { NotificationsService } from './notifications.service.js';

function userId(request: Request): string {
  if (!request.auth) throw new Error('Authentication middleware did not attach auth context');
  return request.auth.userId;
}

export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  list: RequestHandler = async (request, response) => {
    const query = parseRequestQuery(notificationListQuery, request.query);
    const { notifications, unreadCount, meta } = await this.service.list(userId(request), query);
    response.json(ok({ notifications, unreadCount }, meta));
  };

  markAsRead: RequestHandler = async (request, response) => {
    const { notificationId } = parseRequestParams(notificationIdParams, request.params);
    const notification = await this.service.markAsRead(userId(request), notificationId);
    response.json(ok({ notification }));
  };
}
