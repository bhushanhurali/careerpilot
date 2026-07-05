/// <reference types="jasmine" />

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../../../core/config/api.config';
import { ApplicationApiResponse, JobApplication } from './application.models';
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
        source: 'LinkedIn',
        location: 'Munich',
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
        candidate.params.get('companyId') === 'company-1' &&
        candidate.params.get('sortBy') === 'companyName' &&
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
      .updateApplication(application.id, payload)
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

  function success<T>(data: T, meta: Record<string, unknown> = {}): ApplicationApiResponse<T> {
    return {
      success: true,
      data,
      error: null,
      meta,
    };
  }
});
