/// <reference types="jasmine" />

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ContactListQuery } from '../../data-access/contact.models';
import { ContactStore } from '../../data-access/contact.store';
import { ContactListComponent } from './contact-list.component';

describe('ContactListComponent', () => {
  let fixture: ComponentFixture<ContactListComponent>;
  let store: jasmine.SpyObj<ContactStore>;

  beforeEach(async () => {
    const query: ContactListQuery = {
      page: 1,
      pageSize: 10,
      sortBy: 'createdAt',
      sortDirection: 'desc',
    };

    store = jasmine.createSpyObj<ContactStore>('ContactStore', ['loadContacts', 'deleteContact'], {
      contacts: signal([]).asReadonly(),
      query: signal(query).asReadonly(),
      meta: signal({ page: 1, pageSize: 10, total: 0, totalPages: 0 }).asReadonly(),
      loading: signal(false).asReadonly(),
      error: signal(null).asReadonly(),
      hasContacts: signal(false).asReadonly(),
    });
    store.loadContacts.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [ContactListComponent, NoopAnimationsModule],
      providers: [provideRouter([]), { provide: ContactStore, useValue: store }],
    }).compileComponents();
  });

  it('renders the empty state and loads contacts for the company', () => {
    fixture = TestBed.createComponent(ContactListComponent);
    fixture.componentRef.setInput('companyId', 'company-1');
    fixture.componentRef.setInput('companyName', 'Acme GmbH');
    fixture.detectChanges();

    expect(store.loadContacts).toHaveBeenCalledWith('company-1', jasmine.any(Object));
    expect(fixture.nativeElement.textContent).toContain('No contacts yet');
    expect(fixture.nativeElement.textContent).toContain('Acme GmbH');
  });
});
