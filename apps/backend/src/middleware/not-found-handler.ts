import { RequestHandler } from 'express';

import { fail } from '../shared/responses/api-response.js';

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json(
    fail({
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.path} was not found`,
    }),
  );
};
