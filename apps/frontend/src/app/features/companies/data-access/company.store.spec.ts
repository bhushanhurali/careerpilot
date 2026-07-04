/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { CompanyApiError, CompanyApiService } from './company-api.service';
import { Company } from './company.models';
import { CompanyStore } from './company.store';

describe('CompanyStore', () => {
  let api: jasmine.SpyObj<CompanyApiService>;
  let store: CompanyStore;

  const company: Company = {
    id: 'company-1',
    name: 'Acme GmbH',
    website: null,
    industry: 'Software',
    location: 'Berlin',
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<CompanyApiService>('CompanyApiService', [
      'listCompanies',
      'getCompany',
      'createCompany',
      'updateCompany',
      'deleteCompany',
    ]);

    TestBed.configureTestingModule({
      providers: [CompanyStore, { provide: CompanyApiService, useValue: api }],
    });

    store = TestBed.inject(CompanyStore);
  });

  it('loads companies and stores pagination metadata', async () => {
    api.listCompanies.and.returnValue(
      of({
        companies: [company],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      }),
    );

    await firstValueFrom(store.loadCompanies());

    expect(store.companies()).toEqual([company]);
    expect(store.meta().total).toBe(1);
    expect(store.loading()).toBeFalse();
  });

  it('stores list failures as user-facing errors', async () => {
    api.listCompanies.and.returnValue(throwError(() => new Error('Network failed')));

    await firstValueFrom(store.loadCompanies()).catch(() => undefined);

    expect(store.error()).toBe('Network failed');
    expect(store.loading()).toBeFalse();
  });

  it('loads selected companies and handles save/delete workflows', async () => {
    api.getCompany.and.returnValue(of(company));
    api.createCompany.and.returnValue(of(company));
    api.updateCompany.and.returnValue(of({ ...company, name: 'Updated' }));
    api.deleteCompany.and.returnValue(of(undefined));

    await firstValueFrom(store.loadCompany(company.id));
    await firstValueFrom(store.createCompany(formValue()));
    await firstValueFrom(store.updateCompany(company.id, formValue()));
    await firstValueFrom(store.deleteCompany(company.id));

    expect(store.selectedCompany()).toBeNull();
    expect(store.saving()).toBeFalse();
    expect(store.deleting()).toBeFalse();
  });

  it('stores duplicate-name form errors', async () => {
    api.createCompany.and.returnValue(
      throwError(
        () =>
          new CompanyApiError(
            'A company with this name already exists',
            'COMPANY_NAME_ALREADY_EXISTS',
            409,
          ),
      ),
    );

    await firstValueFrom(store.createCompany(formValue())).catch(() => undefined);

    expect(store.formError()?.code).toBe('COMPANY_NAME_ALREADY_EXISTS');
  });

  function formValue() {
    return {
      name: 'Acme GmbH',
      website: null,
      industry: null,
      location: null,
      notes: null,
    };
  }
});
