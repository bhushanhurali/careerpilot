import { Routes } from '@angular/router';

export const contactRoutes: Routes = [
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/contact-create/contact-create.component').then(
        (m) => m.ContactCreateComponent,
      ),
  },
  {
    path: ':contactId/edit',
    loadComponent: () =>
      import('./pages/contact-edit/contact-edit.component').then((m) => m.ContactEditComponent),
  },
  {
    path: ':contactId',
    loadComponent: () =>
      import('./pages/contact-detail/contact-detail.component').then(
        (m) => m.ContactDetailComponent,
      ),
  },
];
