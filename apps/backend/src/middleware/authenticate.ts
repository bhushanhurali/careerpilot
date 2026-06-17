import { RequestHandler } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

import { HttpError } from '../shared/errors/http-error.js';
import { verifyAccessToken } from '../shared/security/jwt.js';

export const authenticate: RequestHandler = (request, _response, next) => {
  const authorization = request.header('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    next(new HttpError(401, 'AUTH_TOKEN_MISSING', 'Access token is required'));
    return;
  }

  const token = authorization.slice('Bearer '.length);

  try {
    const payload = verifyAccessToken(token);
    request.auth = {
      userId: payload.sub,
      role: payload.role,
    };
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      next(new HttpError(401, 'AUTH_TOKEN_EXPIRED', 'Access token has expired'));
      return;
    }

    if (error instanceof JsonWebTokenError || error instanceof Error) {
      next(new HttpError(401, 'AUTH_TOKEN_INVALID', 'Access token is invalid'));
      return;
    }

    next(error);
  }
};
