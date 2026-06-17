import { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import { fail } from '../../shared/responses/api-response.js';

const standardHandler = (_request: Request, response: Response) => {
  response.status(429).json(
    fail({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
    }),
  );
};

export const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
});

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
});

export const refreshRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: standardHandler,
});
