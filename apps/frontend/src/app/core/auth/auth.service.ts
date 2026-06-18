import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import { SKIP_AUTH } from './auth-http-context';
import {
  ApiResponse,
  AuthSessionResponse,
  AuthTokenResponse,
  CurrentUserResponse,
  LoginRequest,
  RegisterRequest,
} from './auth.models';

const authRequestContext = new HttpContext().set(SKIP_AUTH, true);

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authUrl = `${API_BASE_URL}/auth`;

  register(payload: RegisterRequest): Observable<AuthSessionResponse> {
    return this.http
      .post<ApiResponse<AuthSessionResponse>>(`${this.authUrl}/register`, payload, {
        context: authRequestContext,
        withCredentials: true,
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  login(payload: LoginRequest): Observable<AuthSessionResponse> {
    return this.http
      .post<ApiResponse<AuthSessionResponse>>(`${this.authUrl}/login`, payload, {
        context: authRequestContext,
        withCredentials: true,
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  refresh(): Observable<AuthTokenResponse> {
    return this.http
      .post<ApiResponse<AuthTokenResponse>>(
        `${this.authUrl}/refresh`,
        {},
        {
          context: authRequestContext,
          withCredentials: true,
        },
      )
      .pipe(map((response) => this.unwrap(response)));
  }

  logout(): Observable<void> {
    return this.http
      .post<ApiResponse<Record<string, never>>>(
        `${this.authUrl}/logout`,
        {},
        {
          context: authRequestContext,
          withCredentials: true,
        },
      )
      .pipe(map(() => undefined));
  }

  me(): Observable<CurrentUserResponse> {
    return this.http
      .get<ApiResponse<CurrentUserResponse>>(`${this.authUrl}/me`, {
        withCredentials: true,
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (!response.success || !response.data) {
      throw new Error(response.error?.message ?? 'Request failed.');
    }

    return response.data;
  }
}
