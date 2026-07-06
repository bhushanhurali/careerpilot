/// <reference types="jasmine" />

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { CompanyApiService } from '../../../companies/data-access/company-api.service';
import { ContactApiService } from '../../../contacts/data-access/contact-api.service';
import { ApplicationFormValue, JobApplication } from '../../data-access/application.models';
import { ApplicationStore } from '../../data-access/application.store';
import { ApplicationEditPageComponent } from './application-edit-page.component';

describe('ApplicationEditPageComponent', () => {
  let fixture: ComponentFixture<ApplicationEditPageComponent>;
  let store: jasmine.SpyObj<ApplicationStore>;
  let companyApi: jasmine.SpyObj<CompanyApiService>;
  let contactApi: jasmine.SpyObj<ContactApiService>;
  let router: Router;
  let navigateSpy: jasmine.Spy;

  const application: JobApplication = {
    id: 'application-1',
    userId: 'user-1',
    companyId: 'company-1',
    contactId: null,
    jobTitle: 'Angular Developer',
    jobUrl: null,
    source: null,
    status: 'applied',
    priority: 'high',
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

  beforeEach(async () => {
    store = jasmine.createSpyObj<ApplicationStore>(
      'ApplicationStore',
      ['loadApplication', 'updateApplication'],
      {
        selectedApplication: signal(application).asReadonly(),
        selectedLoading: signal(false).asReadonly(),
        saving: signal(false).asReadonly(),
        formError: signal(null).asReadonly(),
        error: signal(null).asReadonly(),
      },
    );
    companyApi = jasmine.createSpyObj<CompanyApiService>('CompanyApiService', ['listCompanies']);
    contactApi = jasmine.createSpyObj<ContactApiService>('ContactApiService', ['listContacts']);
    store.loadApplication.and.returnValue(of(application));
    store.updateApplication.and.returnValue(of(application));
    companyApi.listCompanies.and.returnValue(
      of({ companies: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } }),
    );
    contactApi.listContacts.and.returnValue(
      of({ contacts: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } }),
    );

    await TestBed.configureTestingModule({
      imports: [ApplicationEditPageComponent],
      providers: [
        provideRouter([]),
        { provide: ApplicationStore, useValue: store },
        { provide: CompanyApiService, useValue: companyApi },
        { provide: ContactApiService, useValue: contactApi },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ applicationId: application.id }),
            },
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ApplicationEditPageComponent);
  });

  it('loads the existing application on init', () => {
    fixture.detectChanges();

    expect(store.loadApplication).toHaveBeenCalledWith(application.id);
  });

  it('updates an application and navigates to the detail page', () => {
    componentApi().save(formValue());

    expect(store.updateApplication).toHaveBeenCalledWith(application.id, formValue());
    expect(navigateSpy).toHaveBeenCalledWith(['/applications', application.id]);
  });

  it('returns to the application detail page when cancelled', () => {
    componentApi().cancel();

    expect(navigateSpy).toHaveBeenCalledWith(['/applications', application.id]);
  });

  function componentApi() {
    return fixture.componentInstance as unknown as {
      save: (payload: ApplicationFormValue) => void;
      cancel: () => void;
    };
  }

  function formValue(): ApplicationFormValue {
    return {
      companyId: 'company-1',
      contactId: null,
      jobTitle: 'Angular Developer',
      jobUrl: null,
      source: null,
      status: 'applied',
      priority: 'high',
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
