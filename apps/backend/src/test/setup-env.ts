import { loadRootEnv } from '../config/load-env.js';

const explicitDatabaseUrl = process.env.DATABASE_URL;

process.env.NODE_ENV = 'test';
loadRootEnv();

const databaseUrl =
  explicitDatabaseUrl ??
  `postgres://${process.env.POSTGRES_USER ?? 'careerpilot'}:${process.env.POSTGRES_PASSWORD ?? 'careerpilot_dev_password'}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5432'}/careerpilot_test`;
const databaseName = new URL(databaseUrl).pathname.slice(1);

if (!databaseName.toLowerCase().includes('test')) {
  throw new Error(
    `Backend tests require a dedicated test database. Refusing to run against database "${databaseName}".`,
  );
}

process.env.DATABASE_URL = databaseUrl;
process.env.CORS_ORIGIN ??= 'http://localhost:4200';
process.env.LOG_LEVEL = 'fatal';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-at-least-32-characters';
process.env.ACCESS_TOKEN_TTL_SECONDS ??= '900';
process.env.REFRESH_TOKEN_TTL_SECONDS ??= '2592000';
process.env.COOKIE_SECURE ??= 'false';
