/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Observable, firstValueFrom, isObservable, of } from 'rxjs';

import { AuthStore } from './auth.store';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let router: Router;
  let authStore: {
    status: jasmine.Spy<() => string>;
    isAuthenticated: jasmine.Spy<() => boolean>;
    initialize: jasmine.Spy<() => Observable<void>>;
  };

  beforeEach(() => {
    authStore = {
      status: jasmine.createSpy('status'),
      isAuthenticated: jasmine.createSpy('isAuthenticated'),
      initialize: jasmine.createSpy('initialize').and.returnValue(of(undefined)),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: authStore,
        },
      ],
    });

    router = TestBed.inject(Router);
  });

  it('redirects anonymous users to /auth/login without reinitializing known state', async () => {
    authStore.status.and.returnValue('anonymous');
    authStore.isAuthenticated.and.returnValue(false);

    const result = await runGuard(authGuard);

    expect(result).toEqual(jasmine.any(UrlTree));
    expect(router.serializeUrl(result as UrlTree)).toBe('/auth/login');
    expect(authStore.initialize).not.toHaveBeenCalled();
  });

  it('allows authenticated users without reinitializing known state', async () => {
    authStore.status.and.returnValue('authenticated');
    authStore.isAuthenticated.and.returnValue(true);

    const result = await runGuard(authGuard);

    expect(result).toBeTrue();
    expect(authStore.initialize).not.toHaveBeenCalled();
  });

  async function runGuard(guard: CanActivateFn): Promise<unknown> {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    return isObservable(result) ? firstValueFrom(result) : Promise.resolve(result);
  }
});
