import { Response } from 'express';

import { env } from '../../config/env.js';

export const refreshTokenCookieName = 'careerpilot_refresh_token';

export function setRefreshTokenCookie(response: Response, refreshToken: string): void {
  response.cookie(refreshTokenCookieName, refreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearRefreshTokenCookie(response: Response): void {
  response.clearCookie(refreshTokenCookieName, {
    httpOnly: true,
    secure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
  });
}
