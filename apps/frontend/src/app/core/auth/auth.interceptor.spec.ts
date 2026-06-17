/// <reference types="jasmine" />

import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import { SKIP_AUTH } from './auth-http-context';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from './auth.store';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  let authStore: jasmine.SpyObj<AuthStore>;

  beforeEach(() => {
    authStore = jasmine.createSpyObj<AuthStore>('AuthStore', [
      'accessToken',
      'refreshAccessToken',
      'clearAuth',
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthStore,
          useValue: authStore,
        },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('attaches Authorization Bearer tokens to API requests', () => {
    authStore.accessToken.and.returnValue('access-token');

    httpClient.get(`${API_BASE_URL}/companies`).subscribe();

    const request = httpTestingController.expectOne(`${API_BASE_URL}/companies`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    request.flush({});
  });

  it('skips auth handling when SKIP_AUTH is set', () => {
    authStore.accessToken.and.returnValue('access-token');

    httpClient
      .get(`${API_BASE_URL}/auth/refresh`, {
        context: new HttpContext().set(SKIP_AUTH, true),
      })
      .subscribe();

    const request = httpTestingController.expectOne(`${API_BASE_URL}/auth/refresh`);
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({});
  });

  it('refreshes once on 401 and retries the original request once', () => {
    authStore.accessToken.and.returnValue('expired-access-token');
    authStore.refreshAccessToken.and.returnValue(of('fresh-access-token'));

    httpClient.get(`${API_BASE_URL}/companies`).subscribe((response) => {
      expect(response).toEqual({ ok: true });
    });

    const failedRequest = httpTestingController.expectOne(`${API_BASE_URL}/companies`);
    expect(failedRequest.request.headers.get('Authorization')).toBe('Bearer expired-access-token');
    failedRequest.flush(
      {
        message: 'Unauthorized',
      },
      {
        status: 401,
        statusText: 'Unauthorized',
      },
    );

    const retriedRequest = httpTestingController.expectOne(`${API_BASE_URL}/companies`);
    expect(retriedRequest.request.headers.get('Authorization')).toBe('Bearer fresh-access-token');
    retriedRequest.flush({ ok: true });

    expect(authStore.refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('clears auth when refresh fails after a 401 response', () => {
    authStore.accessToken.and.returnValue('expired-access-token');
    authStore.refreshAccessToken.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' })),
    );

    httpClient.get(`${API_BASE_URL}/companies`).subscribe({
      error: (error: unknown) => {
        expect(error).toEqual(jasmine.any(HttpErrorResponse));
      },
    });

    httpTestingController.expectOne(`${API_BASE_URL}/companies`).flush(
      {
        message: 'Unauthorized',
      },
      {
        status: 401,
        statusText: 'Unauthorized',
      },
    );

    expect(authStore.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(authStore.clearAuth).toHaveBeenCalledTimes(1);
  });
});
