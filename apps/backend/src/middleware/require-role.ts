import { RequestHandler } from 'express';

import { UserRole } from '../db/models/user.model.js';
import { HttpError } from '../shared/errors/http-error.js';

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      next(new HttpError(401, 'AUTH_TOKEN_MISSING', 'Access token is required'));
      return;
    }

    if (!allowedRoles.includes(request.auth.role)) {
      next(new HttpError(403, 'FORBIDDEN', 'You do not have permission to access this resource'));
      return;
    }

    next();
  };
}
