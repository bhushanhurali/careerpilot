/// <reference types="jasmine" />

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../../../core/config/api.config';
import { ApiResponse, Company } from './company.models';
import { CompanyApiService } from './company-api.service';

describe('CompanyApiService', () => {
  let service: CompanyApiService;
  let httpTestingController: HttpTestingController;

  const company: Company = {
    id: 'company-1',
    name: 'Acme GmbH',
    website: 'https://acme.example',
    industry: 'Software',
    location: 'Berlin',
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CompanyApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(CompanyApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('lists companies with query parameters and pagination metadata', () => {
    service
      .listCompanies({
        page: 2,
        pageSize: 10,
        search: 'acme',
        industry: 'Software',
        location: 'Berlin',
        sortBy: 'name',
        sortDirection: 'asc',
      })
      .subscribe((result) => {
        expect(result.companies).toEqual([company]);
        expect(result.meta.total).toBe(1);
      });

    const request = httpTestingController.expectOne(
      (candidate) =>
        candidate.url === `${API_BASE_URL}/companies` &&
        candidate.params.get('search') === 'acme' &&
        candidate.params.get('industry') === 'Software' &&
        candidate.params.get('location') === 'Berlin' &&
        candidate.params.get('page') === '2',
    );
    expect(request.request.method).toBe('GET');
    request.flush(
      success({ companies: [company] }, { page: 2, pageSize: 10, total: 1, totalPages: 1 }),
    );
  });

  it('creates, retrieves, updates, and deletes companies', () => {
    const payload = {
      name: 'Acme GmbH',
      website: null,
      industry: null,
      location: null,
      notes: null,
    };

    service.createCompany(payload).subscribe((result) => expect(result).toEqual(company));
    httpTestingController.expectOne(`${API_BASE_URL}/companies`).flush(success({ company }));

    service.getCompany(company.id).subscribe((result) => expect(result).toEqual(company));
    httpTestingController
      .expectOne(`${API_BASE_URL}/companies/${company.id}`)
      .flush(success({ company }));

    service
      .updateCompany(company.id, payload)
      .subscribe((result) => expect(result).toEqual(company));
    const updateRequest = httpTestingController.expectOne(
      `${API_BASE_URL}/companies/${company.id}`,
    );
    expect(updateRequest.request.method).toBe('PATCH');
    updateRequest.flush(success({ company }));

    service.deleteCompany(company.id).subscribe((result) => expect(result).toBeUndefined());
    const deleteRequest = httpTestingController.expectOne(
      `${API_BASE_URL}/companies/${company.id}`,
    );
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(success({ deleted: true }));
  });

  function success<T>(data: T, meta: Record<string, unknown> = {}): ApiResponse<T> {
    return {
      success: true,
      data,
      error: null,
      meta,
    };
  }
});
