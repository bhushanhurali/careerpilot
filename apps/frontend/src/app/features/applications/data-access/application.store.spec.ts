/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { ApplicationApiError, ApplicationApiService } from './application-api.service';
import { JobApplication } from './application.models';
import { ApplicationStore } from './application.store';

describe('ApplicationStore', () => {
  let api: jasmine.SpyObj<ApplicationApiService>;
  let store: ApplicationStore;

  const application: JobApplication = {
    id: 'application-1',
    userId: 'user-1',
    companyId: 'company-1',
    contactId: null,
    jobTitle: 'Angular Developer',
    jobUrl: null,
    source: null,
    status: 'draft',
    priority: 'medium',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    location: null,
    employmentType: null,
    workMode: null,
    appliedAt: null,
    notes: null,
    company: { id: 'company-1', name: 'Acme GmbH' },
    contact: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<ApplicationApiService>('ApplicationApiService', [
      'listApplications',
      'getApplication',
      'createApplication',
      'updateApplication',
      'deleteApplication',
    ]);

    TestBed.configureTestingModule({
      providers: [ApplicationStore, { provide: ApplicationApiService, useValue: api }],
    });

    store = TestBed.inject(ApplicationStore);
  });

  it('loads applications and stores pagination metadata', async () => {
    api.listApplications.and.returnValue(
      of({
        applications: [application],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      }),
    );

    await firstValueFrom(store.loadApplications({ search: 'angular' }));

    expect(store.applications()).toEqual([application]);
    expect(store.query().search).toBe('angular');
    expect(store.meta().total).toBe(1);
  });

  it('stores failures as user-facing errors', async () => {
    api.listApplications.and.returnValue(throwError(() => new Error('Network failed')));

    await firstValueFrom(store.loadApplications()).catch(() => undefined);

    expect(store.error()).toBe('Network failed');
    expect(store.loading()).toBeFalse();
  });

  it('loads selected applications and handles save/delete workflows', async () => {
    api.getApplication.and.returnValue(of(application));
    api.createApplication.and.returnValue(of(application));
    api.updateApplication.and.returnValue(of({ ...application, jobTitle: 'Updated' }));
    api.deleteApplication.and.returnValue(of(undefined));

    await firstValueFrom(store.loadApplication(application.id));
    await firstValueFrom(store.createApplication(formValue()));
    await firstValueFrom(store.updateApplication(application.id, formValue()));
    await firstValueFrom(store.deleteApplication(application.id));

    expect(store.selectedApplication()).toBeNull();
    expect(store.saving()).toBeFalse();
    expect(store.deleting()).toBeFalse();
  });

  it('stores form errors from create operations', async () => {
    api.createApplication.and.returnValue(
      throwError(() => new ApplicationApiError('Validation failed', 'VALIDATION_ERROR', 400)),
    );

    await firstValueFrom(store.createApplication(formValue())).catch(() => undefined);

    expect(store.formError()?.code).toBe('VALIDATION_ERROR');
  });

  function formValue() {
    return {
      companyId: 'company-1',
      contactId: null,
      jobTitle: 'Angular Developer',
      jobUrl: null,
      source: null,
      status: 'draft' as const,
      priority: 'medium' as const,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      location: null,
      employmentType: null,
      workMode: null,
      appliedAt: null,
      notes: null,
    };
  }
});
