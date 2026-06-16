import { pinoHttp } from 'pino-http';
import crypto from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';

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
  genReqId: (request: IncomingMessage, _response: ServerResponse) => getRequestId(request),
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    remove: true,
  },
});
