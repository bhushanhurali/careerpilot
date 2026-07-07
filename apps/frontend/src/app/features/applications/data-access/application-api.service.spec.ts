/// <reference types="jasmine" />

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../../../core/config/api.config';
import {
  ApplicationApiResponse,
  ApplicationStatusHistoryEntry,
  JobApplication,
} from './application.models';
import { ApplicationApiService } from './application-api.service';

describe('ApplicationApiService', () => {
  let service: ApplicationApiService;
  let httpTestingController: HttpTestingController;

  const application: JobApplication = {
    id: 'application-1',
    userId: 'user-1',
    companyId: 'company-1',
    contactId: null,
    jobTitle: 'Angular Developer',
    jobUrl: null,
    source: 'LinkedIn',
    status: 'applied',
    priority: 'high',
    salaryMin: 65000,
    salaryMax: 80000,
    salaryCurrency: 'EUR',
    location: 'Munich',
    employmentType: 'full_time',
    workMode: 'hybrid',
    appliedAt: '2026-07-05',
    notes: null,
    company: { id: 'company-1', name: 'Acme GmbH' },
    contact: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApplicationApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ApplicationApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('lists applications with query parameters and pagination metadata', () => {
    service
      .listApplications({
        page: 2,
        pageSize: 10,
        search: 'angular',
        status: 'applied',
        priority: 'high',
        companyId: 'company-1',
        contactId: 'contact-1',
        source: 'LinkedIn',
        location: 'Munich',
        employmentType: 'Permanent',
        workMode: 'Hybrid',
        sortBy: 'companyName',
        sortDirection: 'asc',
      })
      .subscribe((result) => {
        expect(result.applications).toEqual([application]);
        expect(result.meta.total).toBe(1);
      });

    const request = httpTestingController.expectOne(
      (candidate) =>
        candidate.url === `${API_BASE_URL}/applications` &&
        candidate.params.get('search') === 'angular' &&
        candidate.params.get('status') === 'applied' &&
        candidate.params.get('priority') === 'high' &&
        candidate.params.get('companyId') === 'company-1' &&
        candidate.params.get('contactId') === 'contact-1' &&
        candidate.params.get('source') === 'LinkedIn' &&
        candidate.params.get('location') === 'Munich' &&
        candidate.params.get('employmentType') === 'Permanent' &&
        candidate.params.get('workMode') === 'Hybrid' &&
        candidate.params.get('sortBy') === 'companyName' &&
        candidate.params.get('sortDirection') === 'asc' &&
        candidate.params.get('page') === '2',
    );
    expect(request.request.method).toBe('GET');
    request.flush(
      success({ applications: [application] }, { page: 2, pageSize: 10, total: 1, totalPages: 1 }),
    );
  });

  it('creates, retrieves, updates, and deletes applications', () => {
    const payload = {
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

    service.createApplication(payload).subscribe((result) => expect(result).toEqual(application));
    httpTestingController.expectOne(`${API_BASE_URL}/applications`).flush(success({ application }));

    service
      .getApplication(application.id)
      .subscribe((result) => expect(result).toEqual(application));
    httpTestingController
      .expectOne(`${API_BASE_URL}/applications/${application.id}`)
      .flush(success({ application }));

    service
      .updateApplication(application.id, {
        companyId: payload.companyId,
        contactId: payload.contactId,
        jobTitle: payload.jobTitle,
        jobUrl: payload.jobUrl,
        source: payload.source,
        priority: payload.priority,
        salaryMin: payload.salaryMin,
        salaryMax: payload.salaryMax,
        salaryCurrency: payload.salaryCurrency,
        location: payload.location,
        employmentType: payload.employmentType,
        workMode: payload.workMode,
        appliedAt: payload.appliedAt,
        notes: payload.notes,
      })
      .subscribe((result) => expect(result).toEqual(application));
    const updateRequest = httpTestingController.expectOne(
      `${API_BASE_URL}/applications/${application.id}`,
    );
    expect(updateRequest.request.method).toBe('PATCH');
    updateRequest.flush(success({ application }));

    service.deleteApplication(application.id).subscribe((result) => expect(result).toBeUndefined());
    const deleteRequest = httpTestingController.expectOne(
      `${API_BASE_URL}/applications/${application.id}`,
    );
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(success({ deleted: true }));
  });

  it('loads status history and creates status transitions', () => {
    const historyEntry: ApplicationStatusHistoryEntry = {
      id: 'history-1',
      applicationId: application.id,
      fromStatus: 'applied',
      toStatus: 'interviewing',
      changedAt: '2026-07-07T10:00:00.000Z',
      note: 'Technical interview',
      createdAt: '2026-07-07T10:00:00.000Z',
      updatedAt: '2026-07-07T10:00:00.000Z',
    };

    service
      .listStatusHistory(application.id)
      .subscribe((result) => expect(result).toEqual([historyEntry]));
    const listRequest = httpTestingController.expectOne(
      `${API_BASE_URL}/applications/${application.id}/status-history`,
    );
    expect(listRequest.request.method).toBe('GET');
    listRequest.flush(success({ statusHistory: [historyEntry] }));

    service
      .createStatusTransition(application.id, {
        status: 'interviewing',
        note: 'Technical interview',
      })
      .subscribe((result) => {
        expect(result.application).toEqual(application);
        expect(result.historyEntry).toEqual(historyEntry);
      });
    const transitionRequest = httpTestingController.expectOne(
      `${API_BASE_URL}/applications/${application.id}/status-transitions`,
    );
    expect(transitionRequest.request.method).toBe('POST');
    expect(transitionRequest.request.body).toEqual({
      status: 'interviewing',
      note: 'Technical interview',
    });
    transitionRequest.flush(success({ application, historyEntry }));
  });

  it('throws an application API error when the response envelope fails', () => {
    service.getApplication(application.id).subscribe({
      next: () => fail('Expected request to fail.'),
      error: (error: unknown) => {
        expect(error).toEqual(
          jasmine.objectContaining({
            code: 'NOT_FOUND',
            message: 'Application not found.',
          }),
        );
      },
    });

    httpTestingController.expectOne(`${API_BASE_URL}/applications/${application.id}`).flush({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Application not found.' },
      meta: {},
    });
  });

  function success<T>(data: T, meta: Record<string, unknown> = {}): ApplicationApiResponse<T> {
    return {
      success: true,
      data,
      error: null,
      meta,
    };
  }
});
