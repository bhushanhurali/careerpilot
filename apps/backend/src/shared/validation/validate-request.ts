import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';

export function validateBody<TBody>(schema: ZodSchema<TBody>): RequestHandler {
  return (request, _response, next) => {
    request.body = schema.parse(request.body);
    next();
  };
}
