import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import { AUTH_RETRY_ATTEMPTED, SKIP_AUTH } from './auth-http-context';
import { AuthStore } from './auth.store';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authStore = inject(AuthStore);

  if (request.context.get(SKIP_AUTH) || !isApiRequest(request)) {
    return next(request);
  }

  const authorizedRequest = addAccessToken(request, authStore.accessToken());

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (!shouldAttemptRefresh(error, authorizedRequest)) {
        return throwError(() => error);
      }

      return retryWithFreshAccessToken(authorizedRequest, next, authStore);
    }),
  );
};

function retryWithFreshAccessToken(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authStore: AuthStore,
) {
  return authStore.refreshAccessToken().pipe(
    switchMap((accessToken) =>
      next(
        addAccessToken(
          request.clone({
            context: request.context.set(AUTH_RETRY_ATTEMPTED, true),
          }),
          accessToken,
        ),
      ),
    ),
    catchError((refreshError: unknown) => {
      authStore.clearAuth();

      return throwError(() => refreshError);
    }),
  );
}

function shouldAttemptRefresh(error: unknown, request: HttpRequest<unknown>): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 401 &&
    !request.context.get(AUTH_RETRY_ATTEMPTED)
  );
}

function addAccessToken<T>(request: HttpRequest<T>, accessToken: string | null): HttpRequest<T> {
  if (!accessToken) {
    return request;
  }

  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

function isApiRequest(request: HttpRequest<unknown>): boolean {
  return request.url.startsWith(API_BASE_URL) || request.url.startsWith('/api/');
}
