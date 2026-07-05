import { Routes } from '@angular/router';

export const companyRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/company-list/company-list-page.component').then(
        (m) => m.CompanyListPageComponent,
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/company-create/company-create-page.component').then(
        (m) => m.CompanyCreatePageComponent,
      ),
  },
  {
    path: ':companyId/contacts',
    loadChildren: () => import('../contacts/contacts.routes').then((m) => m.contactRoutes),
  },
  {
    path: ':companyId',
    loadComponent: () =>
      import('./pages/company-detail/company-detail-page.component').then(
        (m) => m.CompanyDetailPageComponent,
      ),
  },
  {
    path: ':companyId/edit',
    loadComponent: () =>
      import('./pages/company-edit/company-edit-page.component').then(
        (m) => m.CompanyEditPageComponent,
      ),
  },
];
