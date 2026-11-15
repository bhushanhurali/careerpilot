import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { parseEnv } from './env.js';

const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://role:password@postgres:5432/careerpilot',
  CORS_ORIGIN: 'https://jobthreader.com',
  TRUSTED_PROXY_IP: '127.0.0.1',
  JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
  JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
};

describe('backend environment', () => {
  it('accepts an explicit production configuration and preserves the local defaults', () => {
    expect(parseEnv(production)).toMatchObject(production);
    expect(
      parseEnv({
        NODE_ENV: 'development',
        DATABASE_URL: production.DATABASE_URL,
        JWT_ACCESS_SECRET: 'replace-with-at-least-32-characters-access-secret',
        JWT_REFRESH_SECRET: 'replace-with-at-least-32-characters-refresh-secret',
        COOKIE_SECURE: 'false',
      }),
    ).toMatchObject({ CORS_ORIGIN: 'http://localhost:4200', COOKIE_SECURE: false });
  });

  it.each([
    ['DATABASE_URL', undefined],
    ['DATABASE_URL', 'https://postgres/careerpilot'],
    ['DATABASE_URL', 'postgres://postgres/'],
    ['CORS_ORIGIN', undefined],
    ['CORS_ORIGIN', 'https://jobthreader.com/'],
    ['CORS_ORIGIN', 'http://jobthreader.com'],
    ['CORS_ORIGIN', 'https://preview.jobthreader.com'],
    ['TRUSTED_PROXY_IP', undefined],
    ['TRUSTED_PROXY_IP', '0.0.0.0/0'],
    ['TRUSTED_PROXY_IP', 'true'],
    ['JWT_ACCESS_SECRET', 'replace-with-at-least-32-characters-access-secret'],
    ['JWT_ACCESS_SECRET', '0123456789abcdef'.repeat(4)],
    ['JWT_REFRESH_SECRET', production.JWT_ACCESS_SECRET],
    ['COOKIE_SECURE', 'false'],
  ])('rejects an unsafe production %s', (key, value) => {
    expect(() => parseEnv({ ...production, [key]: value })).toThrow(key);
  });
});
