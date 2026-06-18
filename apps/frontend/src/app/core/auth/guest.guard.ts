import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthStore } from './auth.store';

export const guestGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const resolveGuestState = () =>
    authStore.isAuthenticated() ? router.createUrlTree(['/']) : true;

  if (authStore.status() !== 'unknown') {
    return resolveGuestState();
  }

  return authStore.initialize().pipe(map(resolveGuestState));
};
