import { isIP } from 'node:net';

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

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url(),
    CORS_ORIGIN: z.string().url().default('http://localhost:4200'),
    TRUSTED_PROXY_IP: z
      .string()
      .refine((value) => isIP(value) !== 0, 'Use a single proxy IP address')
      .optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    RESUME_STORAGE_DIR: z.string().trim().min(1).default('.careerpilot-data/resumes'),
    RESUME_STORAGE_ID: z.string().uuid().optional(),
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
  })
  .superRefine((settings, context) => {
    if (settings.NODE_ENV !== 'production') return;

    const issue = (key: keyof typeof settings, message: string) =>
      context.addIssue({ code: 'custom', path: [key], message });

    const database = URL.canParse(settings.DATABASE_URL) ? new URL(settings.DATABASE_URL) : null;
    if (
      !database ||
      !['postgres:', 'postgresql:'].includes(database.protocol) ||
      !database.hostname ||
      database.pathname.length < 2
    ) {
      issue('DATABASE_URL', 'Set an explicit PostgreSQL URL with a hostname and database name');
    }
    if (settings.CORS_ORIGIN !== 'https://jobthreader.com') {
      issue('CORS_ORIGIN', 'Set the exact production browser origin: https://jobthreader.com');
    }
    if (settings.TRUSTED_PROXY_IP === undefined) {
      issue('TRUSTED_PROXY_IP', 'Set the IP address of the immediate HTTPS reverse proxy');
    }
    for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      const secret = settings[key];
      if (
        !/^[a-f\d]{64}$/i.test(secret) ||
        new Set(secret.toLowerCase()).size < 10 ||
        /^(.{1,32})\1+$/i.test(secret)
      ) {
        issue(
          key,
          'Use an independently generated 32-byte random secret encoded as 64 hex characters',
        );
      }
    }
    if (settings.JWT_ACCESS_SECRET.toLowerCase() === settings.JWT_REFRESH_SECRET.toLowerCase()) {
      issue('JWT_REFRESH_SECRET', 'Access and refresh secrets must be distinct');
    }
    if (settings.COOKIE_SECURE === false) {
      issue('COOKIE_SECURE', 'Production refresh cookies must be secure');
    }
  });

export function parseEnv(input: NodeJS.ProcessEnv) {
  return envSchema.parse({
    ...input,
    PORT: input.PORT ?? input.BACKEND_PORT,
    CORS_ORIGIN: input.CORS_ORIGIN ?? input.BACKEND_CORS_ORIGIN,
  });
}

export const env = parseEnv(process.env);
