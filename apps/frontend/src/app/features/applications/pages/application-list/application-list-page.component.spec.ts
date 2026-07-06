/// <reference types="jasmine" />

import { signal } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ApplicationListQuery, JobApplication } from '../../data-access/application.models';
import { ApplicationStore } from '../../data-access/application.store';
import { ApplicationListPageComponent } from './application-list-page.component';

describe('ApplicationListPageComponent', () => {
  let fixture: ComponentFixture<ApplicationListPageComponent>;
  let store: jasmine.SpyObj<ApplicationStore>;
  let dialog: MatDialog;
  let openDialogSpy: jasmine.Spy;
  let snackBar: jasmine.SpyObj<MatSnackBar>;

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
    location: 'Munich',
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
    const query: ApplicationListQuery = {
      page: 1,
      pageSize: 10,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
    };

    store = jasmine.createSpyObj<ApplicationStore>(
      'ApplicationStore',
      ['loadApplications', 'deleteApplication'],
      {
        applications: signal([]).asReadonly(),
        query: signal(query).asReadonly(),
        meta: signal({ page: 1, pageSize: 10, total: 0, totalPages: 0 }).asReadonly(),
        loading: signal(false).asReadonly(),
        error: signal(null).asReadonly(),
        hasApplications: signal(false).asReadonly(),
      },
    );
    store.loadApplications.and.returnValue(of(undefined));
    store.deleteApplication.and.returnValue(of(undefined));
    snackBar = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [ApplicationListPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: ApplicationStore, useValue: store },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();

    dialog = TestBed.inject(MatDialog);
    openDialogSpy = spyOn(dialog, 'open');
  });

  it('renders the empty state and loads applications on init', () => {
    fixture = TestBed.createComponent(ApplicationListPageComponent);
    fixture.detectChanges();

    expect(store.loadApplications).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('No applications yet');
  });

  it('normalizes filters and reloads from the first page', fakeAsync(() => {
    fixture = TestBed.createComponent(ApplicationListPageComponent);
    fixture.detectChanges();

    componentApi().filtersForm.setValue({
      search: ' Angular ',
      status: 'applied',
      priority: 'high',
      source: ' LinkedIn ',
      location: ' Munich ',
    });
    tick(300);

    expect(store.loadApplications).toHaveBeenCalledWith(
      jasmine.objectContaining({
        page: 1,
        search: 'Angular',
        status: 'applied',
        priority: 'high',
        source: 'LinkedIn',
        location: 'Munich',
      }),
    );
  }));

  it('updates sorting and pagination through the store query', () => {
    fixture = TestBed.createComponent(ApplicationListPageComponent);
    fixture.detectChanges();

    componentApi().sortChanged({ active: 'companyName', direction: 'asc' });
    componentApi().pageChanged({ pageIndex: 2, pageSize: 20, length: 50 });

    expect(store.loadApplications).toHaveBeenCalledWith(
      jasmine.objectContaining({
        page: 1,
        sortBy: 'companyName',
        sortDirection: 'asc',
      }),
    );
    expect(store.loadApplications).toHaveBeenCalledWith({ page: 3, pageSize: 20 });
  });

  it('opens delete confirmation with the application delete action', () => {
    openDialogSpy.and.returnValue({
      afterClosed: () => of(false),
    } as ReturnType<MatDialog['open']>);
    fixture = TestBed.createComponent(ApplicationListPageComponent);
    fixture.detectChanges();

    componentApi().deleteApplication(application);

    expect(openDialogSpy).toHaveBeenCalled();
    const dialogConfig = openDialogSpy.calls.mostRecent().args[1] as {
      data: {
        jobTitle: string;
        deleteAction: () => ReturnType<ApplicationStore['deleteApplication']>;
      };
    };

    dialogConfig.data.deleteAction().subscribe();

    expect(dialogConfig.data.jobTitle).toBe(application.jobTitle);
    expect(store.deleteApplication).toHaveBeenCalledWith(application.id);
  });

  function componentApi() {
    return fixture.componentInstance as unknown as {
      filtersForm: ApplicationListPageComponent['filtersForm'];
      sortChanged: (sort: { active: string; direction: 'asc' | 'desc' | '' }) => void;
      pageChanged: (event: { pageIndex: number; pageSize: number; length: number }) => void;
      deleteApplication: (applicationToDelete: JobApplication) => void;
    };
  }
});
