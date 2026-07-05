import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, tap, throwError } from 'rxjs';

import { ContactApiError, ContactApiService, toContactApiError } from './contact-api.service';
import {
  Contact,
  ContactFormValue,
  ContactListQuery,
  ContactPaginationMeta,
} from './contact.models';

const defaultQuery: ContactListQuery = {
  page: 1,
  pageSize: 10,
  sortBy: 'createdAt',
  sortDirection: 'desc',
};

const emptyMeta: ContactPaginationMeta = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
};

@Injectable({ providedIn: 'root' })
export class ContactStore {
  private readonly contactApi = inject(ContactApiService);

  private readonly companyIdSignal = signal<string | null>(null);
  private readonly contactsSignal = signal<Contact[]>([]);
  private readonly selectedContactSignal = signal<Contact | null>(null);
  private readonly querySignal = signal<ContactListQuery>(defaultQuery);
  private readonly metaSignal = signal<ContactPaginationMeta>(emptyMeta);
  private readonly loadingSignal = signal(false);
  private readonly selectedLoadingSignal = signal(false);
  private readonly savingSignal = signal(false);
  private readonly deletingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly formErrorSignal = signal<ContactApiError | null>(null);

  readonly companyId = this.companyIdSignal.asReadonly();
  readonly contacts = this.contactsSignal.asReadonly();
  readonly selectedContact = this.selectedContactSignal.asReadonly();
  readonly query = this.querySignal.asReadonly();
  readonly meta = this.metaSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly selectedLoading = this.selectedLoadingSignal.asReadonly();
  readonly saving = this.savingSignal.asReadonly();
  readonly deleting = this.deletingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly formError = this.formErrorSignal.asReadonly();
  readonly hasContacts = computed(() => this.contactsSignal().length > 0);

  loadContacts(companyId: string, queryPatch: Partial<ContactListQuery> = {}): Observable<void> {
    this.ensureCompanyContext(companyId);

    const query = { ...this.querySignal(), ...queryPatch };
    this.querySignal.set(query);
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.contactApi.listContacts(companyId, query).pipe(
      tap((result) => {
        this.contactsSignal.set(result.contacts);
        this.metaSignal.set(result.meta);
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        const apiError = toContactApiError(error);
        this.errorSignal.set(apiError.message);

        return throwError(() => apiError);
      }),
      finalize(() => this.loadingSignal.set(false)),
    );
  }

  loadContact(companyId: string, contactId: string): Observable<Contact> {
    this.ensureCompanyContext(companyId);
    this.selectedLoadingSignal.set(true);
    this.errorSignal.set(null);

    return this.contactApi.getContact(companyId, contactId).pipe(
      tap((contact) => this.selectedContactSignal.set(contact)),
      catchError((error: unknown) => {
        const apiError = toContactApiError(error);
        this.selectedContactSignal.set(null);
        this.errorSignal.set(apiError.message);

        return throwError(() => apiError);
      }),
      finalize(() => this.selectedLoadingSignal.set(false)),
    );
  }

  createContact(companyId: string, payload: ContactFormValue): Observable<Contact> {
    this.ensureCompanyContext(companyId);
    this.savingSignal.set(true);
    this.formErrorSignal.set(null);

    return this.contactApi.createContact(companyId, payload).pipe(
      catchError((error: unknown) => {
        const apiError = toContactApiError(error);
        this.formErrorSignal.set(apiError);

        return throwError(() => apiError);
      }),
      finalize(() => this.savingSignal.set(false)),
    );
  }

  updateContact(
    companyId: string,
    contactId: string,
    payload: ContactFormValue,
  ): Observable<Contact> {
    this.ensureCompanyContext(companyId);
    this.savingSignal.set(true);
    this.formErrorSignal.set(null);

    return this.contactApi.updateContact(companyId, contactId, payload).pipe(
      tap((contact) => this.selectedContactSignal.set(contact)),
      catchError((error: unknown) => {
        const apiError = toContactApiError(error);
        this.formErrorSignal.set(apiError);

        return throwError(() => apiError);
      }),
      finalize(() => this.savingSignal.set(false)),
    );
  }

  deleteContact(companyId: string, contactId: string): Observable<void> {
    this.ensureCompanyContext(companyId);
    this.deletingSignal.set(true);
    this.errorSignal.set(null);

    return this.contactApi.deleteContact(companyId, contactId).pipe(
      tap(() => {
        this.contactsSignal.update((contacts) =>
          contacts.filter((contact) => contact.id !== contactId),
        );
        this.selectedContactSignal.update((contact) =>
          contact?.id === contactId ? null : contact,
        );
      }),
      catchError((error: unknown) => {
        const apiError = toContactApiError(error);
        this.errorSignal.set(apiError.message);

        return throwError(() => apiError);
      }),
      finalize(() => this.deletingSignal.set(false)),
    );
  }

  clearFormError(): void {
    this.formErrorSignal.set(null);
  }

  private ensureCompanyContext(companyId: string): void {
    if (this.companyIdSignal() === companyId) {
      return;
    }

    this.companyIdSignal.set(companyId);
    this.contactsSignal.set([]);
    this.selectedContactSignal.set(null);
    this.querySignal.set(defaultQuery);
    this.metaSignal.set(emptyMeta);
    this.errorSignal.set(null);
    this.formErrorSignal.set(null);
  }
}
