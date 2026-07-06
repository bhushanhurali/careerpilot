/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { CompanyApiService } from '../../../companies/data-access/company-api.service';
import { ContactApiService } from '../../../contacts/data-access/contact-api.service';
import { ApplicationFormComponent } from './application-form.component';

describe('ApplicationFormComponent', () => {
  let fixture: ComponentFixture<ApplicationFormComponent>;
  let component: ApplicationFormComponent;
  let companyApi: jasmine.SpyObj<CompanyApiService>;
  let contactApi: jasmine.SpyObj<ContactApiService>;

  beforeEach(async () => {
    companyApi = jasmine.createSpyObj<CompanyApiService>('CompanyApiService', ['listCompanies']);
    contactApi = jasmine.createSpyObj<ContactApiService>('ContactApiService', ['listContacts']);

    companyApi.listCompanies.and.returnValue(
      of({
        companies: [
          {
            id: 'company-1',
            name: 'Acme GmbH',
            website: null,
            industry: null,
            location: null,
            notes: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      }),
    );
    contactApi.listContacts.and.returnValue(
      of({
        contacts: [
          {
            id: 'contact-1',
            companyId: 'company-1',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@example.com',
            phone: null,
            roleTitle: null,
            linkedInUrl: null,
            notes: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
        meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      }),
    );

    await TestBed.configureTestingModule({
      imports: [ApplicationFormComponent, NoopAnimationsModule],
      providers: [
        { provide: CompanyApiService, useValue: companyApi },
        { provide: ContactApiService, useValue: contactApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('validates required, blank, URL, and salary fields', () => {
    componentApi().submit();

    expect(componentApi().form.controls.companyId.hasError('required')).toBeTrue();
    expect(componentApi().form.controls.jobTitle.hasError('required')).toBeTrue();

    componentApi().form.controls.jobTitle.setValue('   ');
    componentApi().form.controls.jobUrl.setValue('not-a-url');
    componentApi().form.controls.salaryMin.setValue(90000);
    componentApi().form.controls.salaryMax.setValue(80000);

    expect(componentApi().form.controls.jobTitle.hasError('blank')).toBeTrue();
    expect(componentApi().form.controls.jobUrl.hasError('pattern')).toBeTrue();
    expect(componentApi().salaryError()).toContain('Minimum salary');
  });

  it('emits normalized values and uppercases currency', () => {
    const emittedValues: unknown[] = [];
    component.saveApplication.subscribe((value) => emittedValues.push(value));

    componentApi().form.setValue({
      companyId: 'company-1',
      contactId: '',
      jobTitle: ' Angular Developer ',
      jobUrl: '',
      source: ' LinkedIn ',
      status: 'applied',
      priority: 'high',
      salaryMin: 65000,
      salaryMax: 80000,
      salaryCurrency: 'eur',
      location: '',
      employmentType: '',
      workMode: '',
      appliedAt: '2026-07-05',
      notes: '',
    });
    componentApi().submit();

    expect(emittedValues[0]).toEqual({
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
      location: null,
      employmentType: null,
      workMode: null,
      appliedAt: '2026-07-05',
      notes: null,
    });
  });

  it('keeps status selectable by default and can hide it for edit flows', () => {
    expect(fixture.nativeElement.textContent).toContain('Status');

    component.showStatusField = false;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Status');
  });

  it('loads contacts when company changes and clears stale contacts', () => {
    componentApi().form.controls.contactId.setValue('stale-contact');
    componentApi().form.controls.companyId.setValue('company-1');

    expect(contactApi.listContacts).toHaveBeenCalledWith(
      'company-1',
      jasmine.objectContaining({ pageSize: 100 }),
    );
    expect(componentApi().form.controls.contactId.value).toBe('');
  });

  it('keeps an existing contact when it still belongs to the selected company', () => {
    component.application = {
      id: 'application-1',
      userId: 'user-1',
      companyId: 'company-1',
      contactId: 'contact-1',
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
      contact: {
        id: 'contact-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };

    component.ngOnChanges({
      application: {
        currentValue: component.application,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true,
      },
    });

    expect(componentApi().form.controls.contactId.value).toBe('contact-1');
  });

  it('shows an options error and stops loading when contact loading fails', () => {
    contactApi.listContacts.and.returnValue(throwError(() => new Error('Network failed')));

    componentApi().form.controls.companyId.setValue('company-1');

    expect(componentApi().optionsError).toBe('Could not load contacts for the selected company.');
    expect(componentApi().loadingContacts).toBeFalse();
  });

  function componentApi() {
    return component as unknown as {
      form: ApplicationFormComponent['form'];
      submit: () => void;
      salaryError: () => string | null;
      optionsError: string | null;
      loadingContacts: boolean;
    };
  }
});
