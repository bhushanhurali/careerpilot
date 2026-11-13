import { z } from 'zod';

import { loadRootEnv } from './load-env.js';

loadRootEnv();

function isReminderTimeZone(value: string): boolean {
  if (value !== 'UTC' && !/^[A-Za-z][A-Za-z_+-]*(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().url().default('http://localhost:4200'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RESUME_STORAGE_DIR: z.string().trim().min(1).default('.careerpilot-data/resumes'),
  REMINDER_TIME_ZONE: z
    .string()
    .trim()
    .refine(isReminderTimeZone, 'Use an IANA timezone')
    .default('UTC'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT ?? process.env.BACKEND_PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? process.env.BACKEND_CORS_ORIGIN,
  LOG_LEVEL: process.env.LOG_LEVEL,
  RESUME_STORAGE_DIR: process.env.RESUME_STORAGE_DIR,
  REMINDER_TIME_ZONE: process.env.REMINDER_TIME_ZONE,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  ACCESS_TOKEN_TTL_SECONDS: process.env.ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS: process.env.REFRESH_TOKEN_TTL_SECONDS,
  COOKIE_SECURE: process.env.COOKIE_SECURE,
});
