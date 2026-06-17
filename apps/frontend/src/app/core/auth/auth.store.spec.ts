/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';

describe('AuthStore', () => {
  const user = {
    id: 'user-1',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  let authService: jasmine.SpyObj<AuthService>;
  let authStore: AuthStore;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'login',
      'register',
      'refresh',
      'logout',
      'me',
    ]);

    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: Router,
          useValue: jasmine.createSpyObj<Router>('Router', ['navigateByUrl']),
        },
      ],
    });

    authStore = TestBed.inject(AuthStore);
  });

  it('sets anonymous after failed startup refresh and does not retry repeatedly', async () => {
    authService.refresh.and.returnValue(throwError(() => new Error('No refresh cookie')));

    await firstValueFrom(authStore.initialize());
    await firstValueFrom(authStore.initialize());

    expect(authStore.status()).toBe('anonymous');
    expect(authStore.isAuthenticated()).toBeFalse();
    expect(authStore.accessToken()).toBeNull();
    expect(authService.refresh).toHaveBeenCalledTimes(1);
    expect(authService.me).not.toHaveBeenCalled();
  });

  it('refreshes the access token, loads /me, and sets authenticated user on startup', async () => {
    authService.refresh.and.returnValue(of({ accessToken: 'fresh-access-token' }));
    authService.me.and.returnValue(of({ user }));

    await firstValueFrom(authStore.initialize());

    expect(authService.refresh).toHaveBeenCalledTimes(1);
    expect(authService.me).toHaveBeenCalledTimes(1);
    expect(authStore.status()).toBe('authenticated');
    expect(authStore.user()).toEqual(user);
    expect(authStore.accessToken()).toBe('fresh-access-token');
    expect(authStore.displayName()).toBe('Ada Lovelace');
  });

  it('shares an in-flight refresh request between callers', async () => {
    const refreshSubject = new Subject<{ accessToken: string }>();
    authService.refresh.and.returnValue(refreshSubject.asObservable());

    const refreshResults = Promise.all([
      firstValueFrom(authStore.refreshAccessToken()),
      firstValueFrom(authStore.refreshAccessToken()),
    ]);

    refreshSubject.next({ accessToken: 'fresh-access-token' });
    refreshSubject.complete();

    await refreshResults;

    expect(authService.refresh).toHaveBeenCalledTimes(1);
    expect(authStore.accessToken()).toBe('fresh-access-token');
  });

  it('keeps the access token in memory only after login', async () => {
    const localStorageSetItem = spyOn(localStorage, 'setItem');
    const sessionStorageSetItem = spyOn(sessionStorage, 'setItem');

    authService.login.and.returnValue(
      of({
        user,
        accessToken: 'access-token',
      }),
    );

    await firstValueFrom(
      authStore.login({
        email: 'user@example.com',
        password: 'long-secure-password',
      }),
    );

    expect(authStore.accessToken()).toBe('access-token');
    expect(localStorageSetItem).not.toHaveBeenCalled();
    expect(sessionStorageSetItem).not.toHaveBeenCalled();
  });
});
