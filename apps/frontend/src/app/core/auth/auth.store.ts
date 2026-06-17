import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, shareReplay, switchMap, tap } from 'rxjs';

import { AuthService } from './auth.service';
import {
  AuthSessionResponse,
  AuthStatus,
  AuthTokenResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
} from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private readonly statusSignal = signal<AuthStatus>('unknown');
  private readonly userSignal = signal<AuthUser | null>(null);
  private readonly accessTokenSignal = signal<string | null>(null);
  private initialization$?: Observable<void>;
  private refreshInFlight$?: Observable<string>;

  readonly status = this.statusSignal.asReadonly();
  readonly user = this.userSignal.asReadonly();
  readonly accessToken = this.accessTokenSignal.asReadonly();

  readonly isAuthenticated = computed(
    () =>
      this.statusSignal() === 'authenticated' &&
      this.userSignal() !== null &&
      this.accessTokenSignal() !== null,
  );

  readonly displayName = computed(() => {
    const user = this.userSignal();

    return user ? `${user.firstName} ${user.lastName}` : '';
  });

  initialize(): Observable<void> {
    if (this.statusSignal() !== 'unknown') {
      return of(undefined);
    }

    this.initialization$ ??= this.restoreSession().pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.initialization$;
  }

  login(payload: LoginRequest): Observable<AuthUser> {
    return this.authService.login(payload).pipe(
      tap((response) => this.setAuthenticated(response)),
      map((response) => response.user),
    );
  }

  register(payload: RegisterRequest): Observable<AuthUser> {
    return this.authService.register(payload).pipe(
      tap((response) => this.setAuthenticated(response)),
      map((response) => response.user),
    );
  }

  refreshAccessToken(): Observable<string> {
    this.refreshInFlight$ ??= this.authService.refresh().pipe(
      tap((response) => this.setAccessToken(response)),
      map((response) => response.accessToken),
      finalize(() => {
        this.refreshInFlight$ = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.refreshInFlight$;
  }

  logout(): Observable<void> {
    return this.authService.logout().pipe(
      catchError(() => of(undefined)),
      tap(() => {
        this.clearAuth();
        void this.router.navigateByUrl('/auth/login');
      }),
    );
  }

  clearAuth(): void {
    this.setAnonymous();
  }

  private setAnonymous(): void {
    this.statusSignal.set('anonymous');
    this.userSignal.set(null);
    this.accessTokenSignal.set(null);
  }

  private restoreSession(): Observable<void> {
    this.statusSignal.set('unknown');

    return this.refreshAccessToken().pipe(
      switchMap(() => this.loadCurrentUser()),
      catchError(() => {
        this.setAnonymous();

        return of(undefined);
      }),
    );
  }

  private loadCurrentUser(): Observable<void> {
    return this.authService.me().pipe(
      tap((response) => {
        this.userSignal.set(response.user);
        this.statusSignal.set('authenticated');
      }),
      map(() => undefined),
    );
  }

  private setAuthenticated(response: AuthSessionResponse): void {
    this.accessTokenSignal.set(response.accessToken);
    this.userSignal.set(response.user);
    this.statusSignal.set('authenticated');
    this.initialization$ = of(undefined);
  }

  private setAccessToken(response: AuthTokenResponse): void {
    this.accessTokenSignal.set(response.accessToken);
  }
}
