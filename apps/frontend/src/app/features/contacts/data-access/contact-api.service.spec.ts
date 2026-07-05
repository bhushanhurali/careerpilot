/// <reference types="jasmine" />

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../../../core/config/api.config';
import { Contact, ContactApiResponse } from './contact.models';
import { ContactApiService } from './contact-api.service';

describe('ContactApiService', () => {
  let service: ContactApiService;
  let httpTestingController: HttpTestingController;

  const companyId = 'company-1';
  const contact: Contact = {
    id: 'contact-1',
    companyId,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: '+49 30 123',
    roleTitle: 'Recruiter',
    linkedInUrl: 'https://www.linkedin.com/in/ada',
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ContactApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ContactApiService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('lists contacts for a company with query parameters and pagination metadata', () => {
    service
      .listContacts(companyId, {
        page: 2,
        pageSize: 10,
        search: 'ada',
        sortBy: 'firstName',
        sortDirection: 'asc',
      })
      .subscribe((result) => {
        expect(result.contacts).toEqual([contact]);
        expect(result.meta.total).toBe(1);
      });

    const request = httpTestingController.expectOne(
      (candidate) =>
        candidate.url === `${API_BASE_URL}/companies/${companyId}/contacts` &&
        candidate.params.get('search') === 'ada' &&
        candidate.params.get('sortBy') === 'firstName' &&
        candidate.params.get('page') === '2',
    );
    expect(request.request.method).toBe('GET');
    request.flush(
      success({ contacts: [contact] }, { page: 2, pageSize: 10, total: 1, totalPages: 1 }),
    );
  });

  it('creates, retrieves, updates, and deletes contacts through nested company URLs', () => {
    const payload = {
      firstName: 'Ada',
      lastName: null,
      email: null,
      phone: null,
      roleTitle: null,
      linkedInUrl: null,
      notes: null,
    };

    service
      .createContact(companyId, payload)
      .subscribe((result) => expect(result).toEqual(contact));
    httpTestingController
      .expectOne(`${API_BASE_URL}/companies/${companyId}/contacts`)
      .flush(success({ contact }));

    service
      .getContact(companyId, contact.id)
      .subscribe((result) => expect(result).toEqual(contact));
    httpTestingController
      .expectOne(`${API_BASE_URL}/companies/${companyId}/contacts/${contact.id}`)
      .flush(success({ contact }));

    service
      .updateContact(companyId, contact.id, payload)
      .subscribe((result) => expect(result).toEqual(contact));
    const updateRequest = httpTestingController.expectOne(
      `${API_BASE_URL}/companies/${companyId}/contacts/${contact.id}`,
    );
    expect(updateRequest.request.method).toBe('PATCH');
    updateRequest.flush(success({ contact }));

    service
      .deleteContact(companyId, contact.id)
      .subscribe((result) => expect(result).toBeUndefined());
    const deleteRequest = httpTestingController.expectOne(
      `${API_BASE_URL}/companies/${companyId}/contacts/${contact.id}`,
    );
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(success({ deleted: true }));
  });

  function success<T>(data: T, meta: Record<string, unknown> = {}): ContactApiResponse<T> {
    return {
      success: true,
      data,
      error: null,
      meta,
    };
  }
});
