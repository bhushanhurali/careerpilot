process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??=
  'postgres://careerpilot:careerpilot_test_password@localhost:5432/careerpilot_test';
process.env.CORS_ORIGIN ??= 'http://localhost:4200';
process.env.LOG_LEVEL ??= 'fatal';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-at-least-32-characters';
process.env.ACCESS_TOKEN_TTL_SECONDS ??= '900';
process.env.REFRESH_TOKEN_TTL_SECONDS ??= '2592000';
process.env.COOKIE_SECURE ??= 'false';
