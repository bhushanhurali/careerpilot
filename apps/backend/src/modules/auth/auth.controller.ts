import { RequestHandler } from 'express';

import { ok } from '../../shared/responses/api-response.js';
import {
  clearRefreshTokenCookie,
  refreshTokenCookieName,
  setRefreshTokenCookie,
} from '../../shared/security/cookies.js';
import { AuthService } from './auth.service.js';
import { LoginBody, RegisterBody } from './auth.schemas.js';

function getRefreshTokenCookie(cookies: unknown): string | undefined {
  if (!cookies || typeof cookies !== 'object') {
    return undefined;
  }

  const value = (cookies as Partial<Record<string, unknown>>)[refreshTokenCookieName];

  return typeof value === 'string' ? value : undefined;
}

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register: RequestHandler = async (request, response, next) => {
    try {
      const result = await this.authService.register(request.body as RegisterBody);
      setRefreshTokenCookie(response, result.refreshToken);
      response.status(201).json(
        ok({
          user: result.user,
          accessToken: result.accessToken,
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  login: RequestHandler = async (request, response, next) => {
    try {
      const result = await this.authService.login(request.body as LoginBody);
      setRefreshTokenCookie(response, result.refreshToken);
      response.status(200).json(
        ok({
          user: result.user,
          accessToken: result.accessToken,
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  refresh: RequestHandler = async (request, response, next) => {
    try {
      const result = await this.authService.refresh(getRefreshTokenCookie(request.cookies));
      setRefreshTokenCookie(response, result.refreshToken);
      response.status(200).json(
        ok({
          accessToken: result.accessToken,
        }),
      );
    } catch (error) {
      clearRefreshTokenCookie(response);
      next(error);
    }
  };

  logout: RequestHandler = async (request, response, next) => {
    try {
      await this.authService.logout(getRefreshTokenCookie(request.cookies));
      clearRefreshTokenCookie(response);
      response.status(200).json(ok({ loggedOut: true }));
    } catch (error) {
      next(error);
    }
  };

  me: RequestHandler = async (request, response, next) => {
    try {
      if (!request.auth) {
        throw new Error('Authentication middleware did not attach auth context');
      }

      const user = await this.authService.getCurrentUser(request.auth.userId);
      response.status(200).json(ok({ user }));
    } catch (error) {
      next(error);
    }
  };
}
