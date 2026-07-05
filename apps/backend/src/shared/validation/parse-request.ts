import { z } from 'zod';

export function parseRequestBody<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  body: unknown,
): z.output<TSchema> {
  return schema.parse(body) as z.output<TSchema>;
}

export function parseRequestParams<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  params: unknown,
): z.output<TSchema> {
  return schema.parse(params) as z.output<TSchema>;
}

export function parseRequestQuery<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  query: unknown,
): z.output<TSchema> {
  return schema.parse(query) as z.output<TSchema>;
}
