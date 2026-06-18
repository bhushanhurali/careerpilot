import crypto from 'node:crypto';

import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';
import {
  AuthRepository,
  CreateRefreshTokenInput,
  CreateUserInput,
  TransactionContext,
} from './auth.repository.js';
import { RefreshTokenRecord, UserRecord } from './auth.types.js';

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
