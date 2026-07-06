/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { ApplicationApiError, ApplicationApiService } from './application-api.service';
import { ApplicationStatusHistoryEntry, JobApplication } from './application.models';
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
      'listStatusHistory',
      'createStatusTransition',
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

  it('loads status history and stores history failures', async () => {
    const historyEntry: ApplicationStatusHistoryEntry = {
      id: 'history-1',
      applicationId: application.id,
      fromStatus: null,
      toStatus: 'draft',
      changedAt: '2026-07-07T10:00:00.000Z',
      note: null,
      createdAt: '2026-07-07T10:00:00.000Z',
      updatedAt: '2026-07-07T10:00:00.000Z',
    };

    api.listStatusHistory.and.returnValue(of([historyEntry]));

    await firstValueFrom(store.loadStatusHistory(application.id));

    expect(store.statusHistory()).toEqual([historyEntry]);
    expect(store.statusHistoryLoading()).toBeFalse();

    api.listStatusHistory.and.returnValue(
      throwError(() => new ApplicationApiError('History failed', 'HTTP_ERROR', 500)),
    );

    await firstValueFrom(store.loadStatusHistory(application.id)).catch(() => undefined);

    expect(store.statusHistory()).toEqual([]);
    expect(store.statusHistoryError()).toBe('History failed');
  });

  it('creates status transitions and refreshes selected application state', async () => {
    const updatedApplication: JobApplication = { ...application, status: 'interviewing' };
    const existingHistoryEntry: ApplicationStatusHistoryEntry = {
      id: 'history-0',
      applicationId: application.id,
      fromStatus: null,
      toStatus: 'draft',
      changedAt: '2026-07-07T09:00:00.000Z',
      note: null,
      createdAt: '2026-07-07T09:00:00.000Z',
      updatedAt: '2026-07-07T09:00:00.000Z',
    };
    const historyEntry: ApplicationStatusHistoryEntry = {
      id: 'history-1',
      applicationId: application.id,
      fromStatus: 'draft',
      toStatus: 'interviewing',
      changedAt: '2026-07-07T10:00:00.000Z',
      note: 'Technical interview',
      createdAt: '2026-07-07T10:00:00.000Z',
      updatedAt: '2026-07-07T10:00:00.000Z',
    };
    api.getApplication.and.returnValue(of(application));
    api.listStatusHistory.and.returnValue(of([existingHistoryEntry]));
    api.createStatusTransition.and.returnValue(
      of({ application: updatedApplication, historyEntry }),
    );

    await firstValueFrom(store.loadApplication(application.id));
    await firstValueFrom(store.loadStatusHistory(application.id));
    await firstValueFrom(
      store.createStatusTransition(application.id, {
        status: 'interviewing',
        note: 'Technical interview',
      }),
    );

    expect(store.selectedApplication()?.status).toBe('interviewing');
    expect(store.statusHistory()).toEqual([existingHistoryEntry, historyEntry]);
    expect(store.statusTransitionSaving()).toBeFalse();
  });

  it('stores status transition errors and clears them on demand', async () => {
    api.createStatusTransition.and.returnValue(
      throwError(() => new ApplicationApiError('Status unchanged', 'STATUS_UNCHANGED', 400)),
    );

    await firstValueFrom(
      store.createStatusTransition(application.id, { status: 'draft', note: null }),
    ).catch(() => undefined);

    expect(store.statusTransitionError()?.code).toBe('STATUS_UNCHANGED');

    store.clearStatusTransitionError();

    expect(store.statusTransitionError()).toBeNull();
  });

  it('stores form errors from create operations', async () => {
    api.createApplication.and.returnValue(
      throwError(() => new ApplicationApiError('Validation failed', 'VALIDATION_ERROR', 400)),
    );

    await firstValueFrom(store.createApplication(formValue())).catch(() => undefined);

    expect(store.formError()?.code).toBe('VALIDATION_ERROR');
  });

  it('clears selected application and stores an error when detail loading fails', async () => {
    api.getApplication.and.returnValue(of(application));
    await firstValueFrom(store.loadApplication(application.id));

    api.getApplication.and.returnValue(
      throwError(() => new ApplicationApiError('Application not found.', 'NOT_FOUND', 404)),
    );

    await firstValueFrom(store.loadApplication('missing-application')).catch(() => undefined);

    expect(store.selectedApplication()).toBeNull();
    expect(store.error()).toBe('Application not found.');
    expect(store.selectedLoading()).toBeFalse();
  });

  it('stores form errors from update operations and clears them on demand', async () => {
    api.updateApplication.and.returnValue(
      throwError(() => new ApplicationApiError('Validation failed', 'VALIDATION_ERROR', 400)),
    );

    await firstValueFrom(store.updateApplication(application.id, formValue())).catch(
      () => undefined,
    );
    expect(store.formError()?.code).toBe('VALIDATION_ERROR');

    store.clearFormError();

    expect(store.formError()).toBeNull();
    expect(store.saving()).toBeFalse();
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
