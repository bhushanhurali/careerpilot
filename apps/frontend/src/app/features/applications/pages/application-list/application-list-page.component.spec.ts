/// <reference types="jasmine" />

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ApplicationListQuery } from '../../data-access/application.models';
import { ApplicationStore } from '../../data-access/application.store';
import { ApplicationListPageComponent } from './application-list-page.component';

describe('ApplicationListPageComponent', () => {
  let fixture: ComponentFixture<ApplicationListPageComponent>;
  let store: jasmine.SpyObj<ApplicationStore>;

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

    await TestBed.configureTestingModule({
      imports: [ApplicationListPageComponent, NoopAnimationsModule],
      providers: [provideRouter([]), { provide: ApplicationStore, useValue: store }],
    }).compileComponents();
  });

  it('renders the empty state and loads applications on init', () => {
    fixture = TestBed.createComponent(ApplicationListPageComponent);
    fixture.detectChanges();

    expect(store.loadApplications).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('No applications yet');
  });
});
