/// <reference types="jasmine" />

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CompanyListQuery } from '../../data-access/company.models';
import { CompanyStore } from '../../data-access/company.store';
import { CompanyListPageComponent } from './company-list-page.component';

describe('CompanyListPageComponent', () => {
  let fixture: ComponentFixture<CompanyListPageComponent>;
  let store: jasmine.SpyObj<CompanyStore>;

  beforeEach(async () => {
    const query: CompanyListQuery = {
      page: 1,
      pageSize: 10,
      sortBy: 'name',
      sortDirection: 'asc',
    };

    store = jasmine.createSpyObj<CompanyStore>('CompanyStore', ['loadCompanies', 'deleteCompany'], {
      companies: signal([]).asReadonly(),
      query: signal(query).asReadonly(),
      meta: signal({ page: 1, pageSize: 10, total: 0, totalPages: 0 }).asReadonly(),
      loading: signal(false).asReadonly(),
      error: signal(null).asReadonly(),
      hasCompanies: signal(false).asReadonly(),
    });
    store.loadCompanies.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [CompanyListPageComponent, NoopAnimationsModule],
      providers: [provideRouter([]), { provide: CompanyStore, useValue: store }],
    }).compileComponents();
  });

  it('renders the empty state and loads companies on init', () => {
    fixture = TestBed.createComponent(CompanyListPageComponent);
    fixture.detectChanges();

    expect(store.loadCompanies).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('No companies yet');
  });
});
