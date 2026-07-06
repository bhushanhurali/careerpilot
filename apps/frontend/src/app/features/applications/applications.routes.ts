import { Routes } from '@angular/router';

export const applicationRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/application-list/application-list-page.component').then(
        (m) => m.ApplicationListPageComponent,
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/application-create/application-create-page.component').then(
        (m) => m.ApplicationCreatePageComponent,
      ),
  },
  {
    path: ':applicationId/edit',
    loadComponent: () =>
      import('./pages/application-edit/application-edit-page.component').then(
        (m) => m.ApplicationEditPageComponent,
      ),
  },
  {
    path: ':applicationId',
    loadComponent: () =>
      import('./pages/application-detail/application-detail-page.component').then(
        (m) => m.ApplicationDetailPageComponent,
      ),
  },
];
