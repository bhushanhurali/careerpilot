import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { map } from 'rxjs';

import { RegistrationPolicyService } from '../../core/auth/registration-policy.service';

export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'register',
    canActivate: [
      () => {
        const router = inject(Router);
        return inject(RegistrationPolicyService).status$.pipe(
          map((enabled) => enabled || router.createUrlTree(['/login'])),
        );
      },
    ],
    loadComponent: () =>
      import('./register/register-page.component').then((m) => m.RegisterPageComponent),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
];
