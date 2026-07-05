import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import {
  ApplicationApiResponse,
  ApplicationFormValue,
  ApplicationListQuery,
  ApplicationPaginationMeta,
  JobApplication,
} from './application.models';

type ApplicationListResponse = {
  applications: JobApplication[];
};

type ApplicationResponse = {
  application: JobApplication;
};

export class ApplicationApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApplicationApiError';
  }
}

@Injectable({ providedIn: 'root' })
export class ApplicationApiService {
  private readonly http = inject(HttpClient);
  private readonly applicationsUrl = `${API_BASE_URL}/applications`;

  listApplications(
    query: ApplicationListQuery,
  ): Observable<{ applications: JobApplication[]; meta: ApplicationPaginationMeta }> {
    return this.http
      .get<ApplicationApiResponse<ApplicationListResponse>>(this.applicationsUrl, {
        params: this.toParams(query),
      })
      .pipe(
        map((response) => ({
          applications: this.unwrap(response).applications,
          meta: this.toPaginationMeta(response.meta),
        })),
      );
  }

  createApplication(payload: ApplicationFormValue): Observable<JobApplication> {
    return this.http
      .post<ApplicationApiResponse<ApplicationResponse>>(this.applicationsUrl, payload)
      .pipe(map((response) => this.unwrap(response).application));
  }

  getApplication(applicationId: string): Observable<JobApplication> {
    return this.http
      .get<ApplicationApiResponse<ApplicationResponse>>(`${this.applicationsUrl}/${applicationId}`)
      .pipe(map((response) => this.unwrap(response).application));
  }

  updateApplication(
    applicationId: string,
    payload: ApplicationFormValue,
  ): Observable<JobApplication> {
    return this.http
      .patch<
        ApplicationApiResponse<ApplicationResponse>
      >(`${this.applicationsUrl}/${applicationId}`, payload)
      .pipe(map((response) => this.unwrap(response).application));
  }

  deleteApplication(applicationId: string): Observable<void> {
    return this.http
      .delete<
        ApplicationApiResponse<{ deleted: boolean }>
      >(`${this.applicationsUrl}/${applicationId}`)
      .pipe(map(() => undefined));
  }

  private toParams(query: ApplicationListQuery): HttpParams {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize)
      .set('sortBy', query.sortBy)
      .set('sortDirection', query.sortDirection);

    const optionalParams: Record<string, string | undefined> = {
      search: query.search,
      status: query.status,
      priority: query.priority,
      companyId: query.companyId,
      contactId: query.contactId,
      source: query.source,
      location: query.location,
      employmentType: query.employmentType,
      workMode: query.workMode,
    };

    for (const [key, value] of Object.entries(optionalParams)) {
      if (value) {
        params = params.set(key, value);
      }
    }

    return params;
  }

  private unwrap<T>(response: ApplicationApiResponse<T>): T {
    if (!response.success || !response.data) {
      throw new ApplicationApiError(
        response.error?.message ?? 'Request failed.',
        response.error?.code ?? 'API_ERROR',
        0,
      );
    }

    return response.data;
  }

  private toPaginationMeta(meta: Record<string, unknown>): ApplicationPaginationMeta {
    return {
      page: typeof meta['page'] === 'number' ? meta['page'] : 1,
      pageSize: typeof meta['pageSize'] === 'number' ? meta['pageSize'] : 20,
      total: typeof meta['total'] === 'number' ? meta['total'] : 0,
      totalPages: typeof meta['totalPages'] === 'number' ? meta['totalPages'] : 0,
    };
  }
}

export function toApplicationApiError(error: unknown): ApplicationApiError {
  if (error instanceof ApplicationApiError) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    const apiError = error.error as Partial<ApplicationApiResponse<never>> | undefined;
    const errorBody = apiError?.error;

    return new ApplicationApiError(
      errorBody?.message ?? 'Request failed.',
      errorBody?.code ?? 'HTTP_ERROR',
      error.status,
    );
  }

  return new ApplicationApiError(
    error instanceof Error ? error.message : 'Request failed.',
    'UNKNOWN_ERROR',
    0,
  );
}
