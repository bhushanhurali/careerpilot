import { pinoHttp } from 'pino-http';
import crypto from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';

import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const getRequestId = (request: IncomingMessage): string => {
  const requestId = request.headers['x-request-id'];

  if (Array.isArray(requestId)) {
    return requestId[0] ?? crypto.randomUUID();
  }

  return requestId ?? crypto.randomUUID();
};

export const requestLogger = pinoHttp({
  logger,
  genReqId: (request: IncomingMessage, _response: ServerResponse) =>
    env.NODE_ENV === 'production' ? crypto.randomUUID() : getRequestId(request),
  ...(env.NODE_ENV === 'production' && {
    serializers: {
      req: (request: { id: string; method: string }) => ({
        id: request.id,
        method: request.method,
      }),
      res: (response: { statusCode: number }) => ({ statusCode: response.statusCode }),
      err: () => ({ message: 'Request failed' }),
    },
  }),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers.set-cookie',
      'res.headers.content-disposition',
    ],
    remove: true,
  },
});
