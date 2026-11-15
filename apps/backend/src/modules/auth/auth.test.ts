import crypto from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import {
  AuthRepository,
  CreateRefreshTokenInput,
  CreateUserInput,
  TransactionContext,
} from './auth.repository.js';
import { RefreshTokenRecord, UserRecord } from './auth.types.js';
import { AuthService } from './auth.service.js';

class InMemoryAuthRepository implements AuthRepository {
  users: UserRecord[] = [];
  refreshTokens: RefreshTokenRecord[] = [];

  transaction<T>(callback: (transaction: TransactionContext) => Promise<T>): Promise<T> {
    return callback(undefined);
  }

  createUser(input: CreateUserInput): Promise<UserRecord> {
    const user: UserRecord = {
      id: crypto.randomUUID(),
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: 'user',
      isActive: true,
    };

    this.users.push(user);

    return Promise.resolve(user);
  }

  findUserByEmail(email: string): Promise<UserRecord | null> {
    return Promise.resolve(this.users.find((user) => user.email === email.toLowerCase()) ?? null);
  }

  findUserById(id: string): Promise<UserRecord | null> {
    return Promise.resolve(this.users.find((user) => user.id === id) ?? null);
  }

  createRefreshToken(input: CreateRefreshTokenInput): Promise<RefreshTokenRecord> {
    const refreshToken: RefreshTokenRecord = {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      familyId: input.familyId,
      expiresAt: input.expiresAt,
      revokedAt: null,
      replacedByTokenId: null,
    };

    this.refreshTokens.push(refreshToken);

    return Promise.resolve(refreshToken);
  }

  findRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return Promise.resolve(
      this.refreshTokens.find((refreshToken) => refreshToken.tokenHash === tokenHash) ?? null,
    );
  }

  revokeRefreshToken(id: string, replacedByTokenId: string | null): Promise<void> {
    const refreshToken = this.refreshTokens.find((candidate) => candidate.id === id);

    if (refreshToken && !refreshToken.revokedAt) {
      refreshToken.revokedAt = new Date();
      refreshToken.replacedByTokenId = replacedByTokenId;
    }

    return Promise.resolve();
  }

  revokeRefreshTokenFamily(familyId: string): Promise<void> {
    for (const refreshToken of this.refreshTokens) {
      if (refreshToken.familyId === familyId && !refreshToken.revokedAt) {
        refreshToken.revokedAt = new Date();
      }
    }

    return Promise.resolve();
  }
}

type ApiBody<TData> = {
  success: boolean;
  data: TData | null;
  error: {
    code: string;
    message: string;
  } | null;
};

type AuthResponse = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  accessToken: string;
};

type RefreshResponse = {
  accessToken: string;
};

function getSetCookieHeader(response: request.Response): string[] {
  const setCookie = response.headers['set-cookie'];

  if (Array.isArray(setCookie)) {
    return setCookie;
  }

  if (typeof setCookie === 'string') {
    return [setCookie];
  }

  return [];
}

function createTestApp(repository = new InMemoryAuthRepository()) {
  return {
    repository,
    app: createApp({
      authRepository: repository,
      disableRateLimits: true,
    }),
  };
}

async function registerUser(app: ReturnType<typeof createApp>) {
  return request(app).post('/api/v1/auth/register').send({
    email: 'ada@example.com',
    password: 'StrongPassword123!',
    firstName: 'Ada',
    lastName: 'Lovelace',
  });
}

describe('auth API', () => {
  it('blocks direct registration but lets a privately provisioned account log in', async () => {
    const previous = env.REGISTRATION_ENABLED;
    env.REGISTRATION_ENABLED = false;
    try {
      const { app, repository } = createTestApp();
      const configuration = await request(app).get('/api/v1/auth/registration');
      expect(configuration.status).toBe(200);
      expect(configuration.headers['cache-control']).toBe('private, no-store');
      expect(configuration.body).toMatchObject({
        success: true,
        data: { registrationEnabled: false },
      });
      const denied = await registerUser(app);
      expect(denied.status).toBe(403);
      expect(denied.body).toMatchObject({
        success: false,
        error: { code: 'REGISTRATION_DISABLED' },
      });
      expect(denied.headers['set-cookie']).toBeUndefined();
      expect(repository.users).toHaveLength(0);
      const account = {
        email: 'ada@example.com',
        password: 'StrongPassword123!',
        firstName: 'Ada',
        lastName: 'Lovelace',
      };
      const service = new AuthService(repository);
      await service.provisionAccount(account);
      await expect(service.provisionAccount(account)).rejects.toMatchObject({
        code: 'EMAIL_ALREADY_EXISTS',
      });
      expect(repository.users[0]?.passwordHash).not.toBe(account.password);
      expect(repository.refreshTokens).toHaveLength(0);
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: account.email, password: account.password })
        .expect(200);
    } finally {
      env.REGISTRATION_ENABLED = previous;
    }
  });
  it('scopes credentialed browser auth and prevents caching in production', async () => {
    const initial = { ...env };
    Object.assign(env, {
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://jobthreader.com',
      COOKIE_SECURE: undefined,
    });
    try {
      const { app, repository } = createTestApp();
      const origin = env.CORS_ORIGIN;
      const preflight = await request(app)
        .options('/api/v1/auth/login')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST');
      expect(preflight.status).toBe(204);
      expect(preflight.headers['access-control-allow-origin']).toBe(origin);
      expect(preflight.headers['access-control-allow-credentials']).toBe('true');
      const denied = await request(app)
        .options('/api/v1/auth/login')
        .set('Origin', 'https://preview.jobthreader.com')
        .set('Access-Control-Request-Method', 'POST');
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();

      const signup = await request(app).post('/api/v1/auth/register').set('Origin', origin).send({
        email: 'ada@example.com',
        password: 'StrongPassword123!',
        firstName: 'Ada',
        lastName: 'Lovelace',
      });
      expect(signup.status).toBe(201);
      expect(signup.headers['cache-control']).toBe('private, no-store');
      const [cookie] = getSetCookieHeader(signup);
      expect(cookie).toMatch(/; Path=\/api\/v1\/auth;.*; HttpOnly; Secure; SameSite=Lax/);
      expect(cookie).not.toMatch(/; Domain=/i);

      for (const disallowed of [undefined, 'null', 'https://preview.jobthreader.com']) {
        const logout = request(app)
          .post('/api/v1/auth/logout')
          .set('Cookie', cookie ?? '')
          .send({});
        if (disallowed !== undefined) logout.set('Origin', disallowed);
        const response = await logout;
        expect(response.status).toBe(403);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
        expect(response.headers['cache-control']).toBe('private, no-store');
        expect(response.headers['set-cookie']).toBeUndefined();
      }
      expect(repository.refreshTokens[0]?.revokedAt).toBeNull();
      const logout = await request(app)
        .post('/api/v1/auth/logout')
        .set('Origin', origin)
        .set('Cookie', cookie?.split(';')[0] ?? '')
        .send({});
      expect(logout.status).toBe(200);
      expect(getSetCookieHeader(logout)[0]).toMatch(/; HttpOnly; Secure; SameSite=Lax/);
      expect(repository.refreshTokens[0]?.revokedAt).not.toBeNull();
      expect((await request(app).get('/api/v1/resumes')).headers['cache-control']).toBe(
        'private, no-store',
      );
    } finally {
      Object.assign(env, initial);
    }
  });

  it('limits untrusted peers by socket IP and trusted peers by the nearest forwarded client', async () => {
    const initial = { ...env };
    Object.assign(env, { NODE_ENV: 'production', CORS_ORIGIN: 'https://jobthreader.com' });
    try {
      env.TRUSTED_PROXY_IP = '192.0.2.10';
      const directApp = createApp({ authRepository: new InMemoryAuthRepository() });
      const probe = express();
      const trust: unknown = directApp.get('trust proxy');
      probe.set('trust proxy', trust);
      probe.get('/', (incoming, response) => {
        response.json({ protocol: incoming.protocol, host: incoming.hostname });
      });
      await request(probe)
        .get('/')
        .set('Host', 'api.jobthreader.com')
        .set('X-Forwarded-Host', 'attacker.example')
        .set('X-Forwarded-Proto', 'https')
        .expect(200, { protocol: 'http', host: 'api.jobthreader.com' });
      const login = (app: ReturnType<typeof createApp>, forwarded: string) =>
        request(app)
          .post('/api/v1/auth/login')
          .set('Origin', env.CORS_ORIGIN)
          .set('X-Forwarded-For', forwarded)
          .set('Forwarded', 'for=203.0.113.30;proto=https')
          .set('X-Forwarded-Proto', 'https')
          .set('X-Forwarded-Host', 'attacker.example')
          .send({});
      for (let index = 1; index <= 11; index++) {
        expect((await login(directApp, `198.51.100.${String(index)}`)).status).toBe(
          index === 11 ? 429 : 400,
        );
      }

      env.TRUSTED_PROXY_IP = '127.0.0.1';
      const proxiedApp = createApp({ authRepository: new InMemoryAuthRepository() });
      for (let index = 1; index <= 11; index++) {
        expect((await login(proxiedApp, `198.51.100.${String(index)}, 203.0.113.10`)).status).toBe(
          index === 11 ? 429 : 400,
        );
      }
      expect((await login(proxiedApp, '203.0.113.11')).status).toBe(400);
    } finally {
      Object.assign(env, initial);
    }
  });

  it('does not log malformed production request payloads or return them in errors', async () => {
    const initial = env.NODE_ENV;
    env.NODE_ENV = 'production';
    const { logger } = await import('../../config/logger.js');
    const log = vi.spyOn(logger, 'error');
    try {
      const { app } = createTestApp();
      const response = await request(app)
        .post('/api/v1/auth/login')
        .type('json')
        .send('{"password":"must-not-leak"');
      expect(response.text).not.toContain('must-not-leak');
      expect(log).toHaveBeenCalledOnce();
      expect(log.mock.calls[0]?.[1]).toBe('Unhandled application error');
      expect(JSON.stringify(log.mock.calls)).toMatch(/"requestId":"[a-f0-9-]+"/);
      expect(JSON.stringify(log.mock.calls)).not.toContain('must-not-leak');
    } finally {
      env.NODE_ENV = initial;
      log.mockRestore();
    }
  });

  it('registers a user, returns an access token, and sets an HTTP-only refresh cookie', async () => {
    const { app, repository } = createTestApp();
    const response = await registerUser(app);
    const body = response.body as ApiBody<AuthResponse>;
    const cookies = getSetCookieHeader(response);

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data?.user.email).toBe('ada@example.com');
    expect(body.data?.user.firstName).toBe('Ada');
    expect(body.data?.user.lastName).toBe('Lovelace');
    expect(body.data?.accessToken).toEqual(expect.any(String));
    expect(cookies.some((cookie) => cookie.includes('HttpOnly'))).toBe(true);
    expect(cookies.some((cookie) => cookie.includes('careerpilot_refresh_token='))).toBe(true);
    expect(repository.users).toHaveLength(1);
    expect(repository.refreshTokens).toHaveLength(1);
    expect(repository.refreshTokens[0]?.tokenHash).not.toContain('.');
  });

  it('logs in with valid credentials', async () => {
    const { app } = createTestApp();
    await registerUser(app);

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'ada@example.com',
      password: 'StrongPassword123!',
    });
    const body = response.body as ApiBody<AuthResponse>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.accessToken).toEqual(expect.any(String));
    expect(getSetCookieHeader(response).some((cookie) => cookie.includes('HttpOnly'))).toBe(true);
  });

  it('rejects invalid credentials without revealing whether email or password is wrong', async () => {
    const { app } = createTestApp();
    await registerUser(app);

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'ada@example.com',
      password: 'WrongPassword123!',
    });
    const body = response.body as ApiBody<never>;

    expect(response.status).toBe(401);
    expect(body.error?.code).toBe('INVALID_CREDENTIALS');
    expect(body.error?.message).toBe('Invalid email or password');
  });

  it('returns the current user from /me when a valid access token is provided', async () => {
    const { app } = createTestApp();
    const registerResponse = await registerUser(app);
    const registerBody = registerResponse.body as ApiBody<AuthResponse>;

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registerBody.data?.accessToken ?? ''}`);
    const body = response.body as ApiBody<{ user: AuthResponse['user'] }>;

    expect(response.status).toBe(200);
    expect(body.data?.user.email).toBe('ada@example.com');
  });

  it('refreshes access tokens and rotates refresh tokens', async () => {
    const { app, repository } = createTestApp();
    const registerResponse = await registerUser(app);
    const originalCookie = getSetCookieHeader(registerResponse);

    const response = await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);
    const body = response.body as ApiBody<RefreshResponse>;
    const nextCookie = getSetCookieHeader(response);

    expect(response.status).toBe(200);
    expect(body.data?.accessToken).toEqual(expect.any(String));
    expect(nextCookie.some((cookie) => cookie.includes('careerpilot_refresh_token='))).toBe(true);
    expect(repository.refreshTokens).toHaveLength(2);
    expect(repository.refreshTokens[0]?.revokedAt).toBeInstanceOf(Date);
    expect(repository.refreshTokens[0]?.replacedByTokenId).toBe(repository.refreshTokens[1]?.id);
  });

  it('rejects reuse of a revoked refresh token', async () => {
    const { app } = createTestApp();
    const registerResponse = await registerUser(app);
    const originalCookie = getSetCookieHeader(registerResponse);

    await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);

    const response = await request(app).post('/api/v1/auth/refresh').set('Cookie', originalCookie);
    const body = response.body as ApiBody<never>;

    expect(response.status).toBe(401);
    expect(body.error?.code).toBe('REFRESH_TOKEN_REVOKED');
  });

  it('logs out by revoking the refresh token and clearing the cookie', async () => {
    const { app, repository } = createTestApp();
    const registerResponse = await registerUser(app);
    const originalCookie = getSetCookieHeader(registerResponse);

    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', originalCookie)
      .send({});
    const body = response.body as ApiBody<{ loggedOut: boolean }>;
    const cookies = getSetCookieHeader(response);

    expect(response.status).toBe(200);
    expect(body.data?.loggedOut).toBe(true);
    expect(repository.refreshTokens[0]?.revokedAt).toBeInstanceOf(Date);
    expect(cookies.some((cookie) => cookie.includes('careerpilot_refresh_token=;'))).toBe(true);
  });
});
