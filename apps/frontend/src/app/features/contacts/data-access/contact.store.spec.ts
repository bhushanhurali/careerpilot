/// <reference types="jasmine" />

import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { ContactApiError, ContactApiService } from './contact-api.service';
import { Contact } from './contact.models';
import { ContactStore } from './contact.store';

describe('ContactStore', () => {
  let api: jasmine.SpyObj<ContactApiService>;
  let store: ContactStore;

  const companyId = 'company-1';
  const contact: Contact = {
    id: 'contact-1',
    companyId,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: null,
    roleTitle: 'Recruiter',
    linkedInUrl: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<ContactApiService>('ContactApiService', [
      'listContacts',
      'getContact',
      'createContact',
      'updateContact',
      'deleteContact',
    ]);

    TestBed.configureTestingModule({
      providers: [ContactStore, { provide: ContactApiService, useValue: api }],
    });

    store = TestBed.inject(ContactStore);
  });

  it('loads contacts and stores pagination metadata', async () => {
    api.listContacts.and.returnValue(
      of({
        contacts: [contact],
        meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      }),
    );

    await firstValueFrom(store.loadContacts(companyId));

    expect(store.contacts()).toEqual([contact]);
    expect(store.meta().total).toBe(1);
    expect(store.loading()).toBeFalse();
  });

  it('stores list failures as user-facing errors', async () => {
    api.listContacts.and.returnValue(throwError(() => new Error('Network failed')));

    await firstValueFrom(store.loadContacts(companyId)).catch(() => undefined);

    expect(store.error()).toBe('Network failed');
    expect(store.loading()).toBeFalse();
  });

  it('loads selected contacts and handles save/delete workflows', async () => {
    api.getContact.and.returnValue(of(contact));
    api.createContact.and.returnValue(of(contact));
    api.updateContact.and.returnValue(of({ ...contact, firstName: 'Grace' }));
    api.deleteContact.and.returnValue(of(undefined));

    await firstValueFrom(store.loadContact(companyId, contact.id));
    await firstValueFrom(store.createContact(companyId, formValue()));
    await firstValueFrom(store.updateContact(companyId, contact.id, formValue()));
    await firstValueFrom(store.deleteContact(companyId, contact.id));

    expect(store.selectedContact()).toBeNull();
    expect(store.saving()).toBeFalse();
    expect(store.deleting()).toBeFalse();
  });

  it('resets contact state when the company id changes', async () => {
    api.listContacts.and.returnValue(
      of({
        contacts: [contact],
        meta: { page: 2, pageSize: 10, total: 1, totalPages: 1 },
      }),
    );
    await firstValueFrom(store.loadContacts(companyId, { page: 2, search: 'ada' }));

    api.listContacts.and.returnValue(
      of({
        contacts: [],
        meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      }),
    );
    await firstValueFrom(store.loadContacts('company-2'));

    expect(store.companyId()).toBe('company-2');
    expect(store.query().page).toBe(1);
    expect(store.query().search).toBeUndefined();
  });

  it('stores form errors from create and update operations', async () => {
    api.createContact.and.returnValue(
      throwError(() => new ContactApiError('Validation failed', 'VALIDATION_ERROR', 400)),
    );

    await firstValueFrom(store.createContact(companyId, formValue())).catch(() => undefined);

    expect(store.formError()?.code).toBe('VALIDATION_ERROR');
  });

  function formValue() {
    return {
      firstName: 'Ada',
      lastName: null,
      email: null,
      phone: null,
      roleTitle: null,
      linkedInUrl: null,
      notes: null,
    };
  }
});
