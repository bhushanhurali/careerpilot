/// <reference types="jasmine" />

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../config/api.config';
import { SKIP_AUTH } from './auth-http-context';
import {
  ApiResponse,
  AuthSessionResponse,
  AuthTokenResponse,
  CurrentUserResponse,
} from './auth.models';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let httpTestingController: HttpTestingController;

  const user = {
    id: 'user-1',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthService, provideHttpClient(), provideHttpClientTesting()],
    });

    authService = TestBed.inject(AuthService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('posts register requests with credentials and unwraps auth session responses', () => {
    const payload = {
      email: 'user@example.com',
      password: 'long-secure-password',
      firstName: 'Ada',
      lastName: 'Lovelace',
    };
    const data: AuthSessionResponse = {
      user,
      accessToken: 'access-token',
    };
    const response: ApiResponse<AuthSessionResponse> = {
      success: true,
      data,
      error: null,
      meta: {},
    };

    authService.register(payload).subscribe((result) => {
      expect(result).toEqual(data);
    });

    const request = httpTestingController.expectOne(`${API_BASE_URL}/auth/register`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.context.get(SKIP_AUTH)).toBeTrue();
    request.flush(response);
  });

  it('posts login requests with credentials and unwraps auth session responses', () => {
    const payload = {
      email: 'user@example.com',
      password: 'long-secure-password',
    };
    const data: AuthSessionResponse = {
      user,
      accessToken: 'access-token',
    };
    const response: ApiResponse<AuthSessionResponse> = {
      success: true,
      data,
      error: null,
      meta: {},
    };

    authService.login(payload).subscribe((result) => {
      expect(result).toEqual(data);
    });

    const request = httpTestingController.expectOne(`${API_BASE_URL}/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.context.get(SKIP_AUTH)).toBeTrue();
    request.flush(response);
  });

  it('posts refresh requests with credentials and unwraps access token responses', () => {
    const data: AuthTokenResponse = {
      accessToken: 'fresh-access-token',
    };
    const response: ApiResponse<AuthTokenResponse> = {
      success: true,
      data,
      error: null,
      meta: {},
    };

    authService.refresh().subscribe((result) => {
      expect(result).toEqual(data);
    });

    const request = httpTestingController.expectOne(`${API_BASE_URL}/auth/refresh`);
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.context.get(SKIP_AUTH)).toBeTrue();
    request.flush(response);
  });

  it('gets the current user with credentials', () => {
    const data: CurrentUserResponse = {
      user,
    };
    const response: ApiResponse<CurrentUserResponse> = {
      success: true,
      data,
      error: null,
      meta: {},
    };

    authService.me().subscribe((result) => {
      expect(result).toEqual(data);
    });

    const request = httpTestingController.expectOne(`${API_BASE_URL}/auth/me`);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.context.get(SKIP_AUTH)).toBeFalse();
    request.flush(response);
  });

  it('throws when the backend returns a failed API response', () => {
    const response: ApiResponse<AuthTokenResponse> = {
      success: false,
      data: null,
      error: {
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Refresh token is invalid',
      },
      meta: {},
    };

    authService.refresh().subscribe({
      error: (error: unknown) => {
        expect(error).toEqual(jasmine.any(Error));
        expect((error as Error).message).toBe('Refresh token is invalid');
      },
    });

    httpTestingController.expectOne(`${API_BASE_URL}/auth/refresh`).flush(response);
  });
});
