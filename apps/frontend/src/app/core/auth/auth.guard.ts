import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthStore } from './auth.store';

export const authGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const resolveAuthState = () =>
    authStore.isAuthenticated() ? true : router.createUrlTree(['/auth/login']);

  if (authStore.status() !== 'unknown') {
    return resolveAuthState();
  }

  return authStore.initialize().pipe(map(resolveAuthState));
};
