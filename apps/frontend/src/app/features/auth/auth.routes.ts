import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./register/register-page.component').then((m) => m.RegisterPageComponent),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
];
