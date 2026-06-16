import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

import { logger } from '../config/logger.js';
import { HttpError } from '../shared/errors/http-error.js';
import { fail } from '../shared/responses/api-response.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json(
      fail({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.flatten(),
      }),
    );
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json(
      fail({
        code: error.code,
        message: error.message,
        details: error.details,
      }),
    );
    return;
  }

  logger.error({ error }, 'Unhandled application error');
  response.status(500).json(
    fail({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    }),
  );
};
