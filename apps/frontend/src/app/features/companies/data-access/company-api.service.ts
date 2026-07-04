import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import {
  ApiResponse,
  Company,
  CompanyFormValue,
  CompanyListQuery,
  PaginationMeta,
} from './company.models';

type CompanyListResponse = {
  companies: Company[];
};

type CompanyResponse = {
  company: Company;
};

export class CompanyApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CompanyApiError';
  }
}

@Injectable({ providedIn: 'root' })
export class CompanyApiService {
  private readonly http = inject(HttpClient);
  private readonly companiesUrl = `${API_BASE_URL}/companies`;

  listCompanies(
    query: CompanyListQuery,
  ): Observable<{ companies: Company[]; meta: PaginationMeta }> {
    return this.http
      .get<ApiResponse<CompanyListResponse>>(this.companiesUrl, {
        params: this.toParams(query),
      })
      .pipe(
        map((response) => ({
          companies: this.unwrap(response).companies,
          meta: this.toPaginationMeta(response.meta),
        })),
      );
  }

  createCompany(payload: CompanyFormValue): Observable<Company> {
    return this.http
      .post<ApiResponse<CompanyResponse>>(this.companiesUrl, payload)
      .pipe(map((response) => this.unwrap(response).company));
  }

  getCompany(companyId: string): Observable<Company> {
    return this.http
      .get<ApiResponse<CompanyResponse>>(`${this.companiesUrl}/${companyId}`)
      .pipe(map((response) => this.unwrap(response).company));
  }

  updateCompany(companyId: string, payload: CompanyFormValue): Observable<Company> {
    return this.http
      .patch<ApiResponse<CompanyResponse>>(`${this.companiesUrl}/${companyId}`, payload)
      .pipe(map((response) => this.unwrap(response).company));
  }

  deleteCompany(companyId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<{ deleted: boolean }>>(`${this.companiesUrl}/${companyId}`)
      .pipe(map(() => undefined));
  }

  private toParams(query: CompanyListQuery): HttpParams {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize)
      .set('sortBy', query.sortBy)
      .set('sortDirection', query.sortDirection);

    if (query.search) {
      params = params.set('search', query.search);
    }

    if (query.industry) {
      params = params.set('industry', query.industry);
    }

    if (query.location) {
      params = params.set('location', query.location);
    }

    return params;
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (!response.success || !response.data) {
      throw new CompanyApiError(
        response.error?.message ?? 'Request failed.',
        response.error?.code ?? 'API_ERROR',
        0,
      );
    }

    return response.data;
  }

  private toPaginationMeta(meta: Record<string, unknown>): PaginationMeta {
    return {
      page: typeof meta['page'] === 'number' ? meta['page'] : 1,
      pageSize: typeof meta['pageSize'] === 'number' ? meta['pageSize'] : 20,
      total: typeof meta['total'] === 'number' ? meta['total'] : 0,
      totalPages: typeof meta['totalPages'] === 'number' ? meta['totalPages'] : 0,
    };
  }
}

export function toCompanyApiError(error: unknown): CompanyApiError {
  if (error instanceof CompanyApiError) {
    return error;
  }

  if (error instanceof HttpErrorResponse) {
    const apiError = error.error as Partial<ApiResponse<never>> | undefined;
    const errorBody = apiError?.error;

    return new CompanyApiError(
      errorBody?.message ?? 'Request failed.',
      errorBody?.code ?? 'HTTP_ERROR',
      error.status,
    );
  }

  return new CompanyApiError(
    error instanceof Error ? error.message : 'Request failed.',
    'UNKNOWN_ERROR',
    0,
  );
}
