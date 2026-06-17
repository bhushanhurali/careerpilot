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
import { guestGuard } from './guest.guard';

describe('guestGuard', () => {
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

  it('allows anonymous users without reinitializing known state', async () => {
    authStore.status.and.returnValue('anonymous');
    authStore.isAuthenticated.and.returnValue(false);

    const result = await runGuard(guestGuard);

    expect(result).toBeTrue();
    expect(authStore.initialize).not.toHaveBeenCalled();
  });

  it('redirects authenticated users to / without reinitializing known state', async () => {
    authStore.status.and.returnValue('authenticated');
    authStore.isAuthenticated.and.returnValue(true);

    const result = await runGuard(guestGuard);

    expect(result).toEqual(jasmine.any(UrlTree));
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
    expect(authStore.initialize).not.toHaveBeenCalled();
  });

  async function runGuard(guard: CanActivateFn): Promise<unknown> {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    return isObservable(result) ? firstValueFrom(result) : Promise.resolve(result);
  }
});
