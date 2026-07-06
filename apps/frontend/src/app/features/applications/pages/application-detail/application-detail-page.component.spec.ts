/// <reference types="jasmine" />

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import {
  ApplicationStatusHistoryEntry,
  JobApplication,
} from '../../data-access/application.models';
import { ApplicationStore } from '../../data-access/application.store';
import { ApplicationDetailPageComponent } from './application-detail-page.component';

describe('ApplicationDetailPageComponent', () => {
  let fixture: ComponentFixture<ApplicationDetailPageComponent>;
  let store: jasmine.SpyObj<ApplicationStore>;

  const application: JobApplication = {
    id: 'application-1',
    userId: 'user-1',
    companyId: 'company-1',
    contactId: 'contact-1',
    jobTitle: 'Angular Developer',
    jobUrl: null,
    source: null,
    status: 'interviewing',
    priority: 'high',
    salaryMin: 70000,
    salaryMax: 90000,
    salaryCurrency: 'EUR',
    location: 'Munich',
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
  const historyEntry: ApplicationStatusHistoryEntry = {
    id: 'history-1',
    applicationId: application.id,
    fromStatus: 'applied',
    toStatus: 'interviewing',
    changedAt: '2026-07-07T10:00:00.000Z',
    note: 'Technical interview scheduled',
    createdAt: '2026-07-07T10:00:00.000Z',
    updatedAt: '2026-07-07T10:00:00.000Z',
  };

  beforeEach(async () => {
    store = jasmine.createSpyObj<ApplicationStore>(
      'ApplicationStore',
      [
        'loadApplication',
        'loadStatusHistory',
        'createStatusTransition',
        'clearStatusTransitionError',
        'deleteApplication',
      ],
      {
        selectedApplication: signal(application).asReadonly(),
        statusHistory: signal([historyEntry]).asReadonly(),
        selectedLoading: signal(false).asReadonly(),
        statusHistoryLoading: signal(false).asReadonly(),
        statusHistoryError: signal(null).asReadonly(),
        statusTransitionSaving: signal(false).asReadonly(),
        statusTransitionError: signal(null).asReadonly(),
        error: signal(null).asReadonly(),
      },
    );
    store.loadApplication.and.returnValue(of(application));
    store.loadStatusHistory.and.returnValue(of([historyEntry]));
    store.createStatusTransition.and.returnValue(of(application));
    store.deleteApplication.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [ApplicationDetailPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ApplicationStore, useValue: store },
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
  });

  it('loads and renders the selected application', () => {
    fixture = TestBed.createComponent(ApplicationDetailPageComponent);
    fixture.detectChanges();

    expect(store.loadApplication).toHaveBeenCalledWith(application.id);
    expect(store.loadStatusHistory).toHaveBeenCalledWith(application.id);
    expect(fixture.nativeElement.textContent).toContain('Angular Developer');
    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
    expect(fixture.nativeElement.textContent).toContain('Applied to Interviewing');
    expect(fixture.nativeElement.textContent).toContain('Technical interview scheduled');
  });
});
