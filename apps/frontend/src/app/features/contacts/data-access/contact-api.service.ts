import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import {
  Contact,
  ContactApiResponse,
  ContactFormValue,
  ContactListQuery,
  ContactPaginationMeta,
} from './contact.models';

type ContactListResponse = {
  contacts: Contact[];
};

type ContactResponse = {
  contact: Contact;
};

export class ContactApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ContactApiError';
  }
}

@Injectable({ providedIn: 'root' })
export class ContactApiService {
  private readonly http = inject(HttpClient);

  listContacts(
    companyId: string,
    query: ContactListQuery,
  ): Observable<{ contacts: Contact[]; meta: ContactPaginationMeta }> {
    return this.http
      .get<ContactApiResponse<ContactListResponse>>(this.contactsUrl(companyId), {
        params: this.toParams(query),
      })
      .pipe(
        map((response) => ({
          contacts: this.unwrap(response).contacts,
          meta: this.toPaginationMeta(response.meta),
        })),
      );
  }

  createContact(companyId: string, payload: ContactFormValue): Observable<Contact> {
    return this.http
      .post<ContactApiResponse<ContactResponse>>(this.contactsUrl(companyId), payload)
      .pipe(map((response) => this.unwrap(response).contact));
  }

  getContact(companyId: string, contactId: string): Observable<Contact> {
    return this.http
      .get<ContactApiResponse<ContactResponse>>(this.contactUrl(companyId, contactId))
      .pipe(map((response) => this.unwrap(response).contact));
  }

  updateContact(
    companyId: string,
    contactId: string,
    payload: ContactFormValue,
  ): Observable<Contact> {
    return this.http
      .patch<ContactApiResponse<ContactResponse>>(this.contactUrl(companyId, contactId), payload)
      .pipe(map((response) => this.unwrap(response).contact));
  }

  deleteContact(companyId: string, contactId: string): Observable<void> {
    return this.http
      .delete<ContactApiResponse<{ deleted: boolean }>>(this.contactUrl(companyId, contactId))
      .pipe(map(() => undefined));
  }

  private contactsUrl(companyId: string): string {
    return `${API_BASE_URL}/companies/${companyId}/contacts`;
  }

  private contactUrl(companyId: string, contactId: string): string {
    return `${this.contactsUrl(companyId)}/${contactId}`;
  }

  private toParams(query: ContactListQuery): HttpParams {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize)
      .set('sortBy', query.sortBy)
      .set('sortDirection', query.sortDirection);

    if (query.search) {
      params = params.set('search', query.search);
    }

    return params;
  }

  private unwrap<T>(response: ContactApiResponse<T>): T {
    if (!response.success || !response.data) {
      throw new ContactApiError(
        response.error?.message ?? 'Request failed.',
        response.error?.code ?? 'API_ERROR',
        0,
      );
    }

    return response.data;
  }

  private toPaginationMeta(meta: Record<string, unknown>): ContactPaginationMeta {
    return {
      page: typeof meta['page'] === 'number' ? meta['page'] : 1,
      pageSize: typeof meta['pageSize'] === 'number' ? meta['pageSize'] : 20,
      total: typeof meta['total'] === 'number' ? meta['total'] : 0,
      totalPages: typeof meta['totalPages'] === 'number' ? meta['totalPages'] : 0,
    };
  }
}

export function toContactApiError(error: unknown): ContactApiError {
  if (error instanceof ContactApiError) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    const apiError = error.error as Partial<ContactApiResponse<never>> | undefined;
    const errorBody = apiError?.error;

    return new ContactApiError(
      errorBody?.message ?? 'Request failed.',
      errorBody?.code ?? 'HTTP_ERROR',
      error.status,
    );
  }

  return new ContactApiError(
    error instanceof Error ? error.message : 'Request failed.',
    'UNKNOWN_ERROR',
    0,
  );
}
