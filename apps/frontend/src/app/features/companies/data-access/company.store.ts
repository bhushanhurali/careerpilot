import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, tap, throwError } from 'rxjs';

import { CompanyApiError, CompanyApiService, toCompanyApiError } from './company-api.service';
import { Company, CompanyFormValue, CompanyListQuery, PaginationMeta } from './company.models';

const defaultQuery: CompanyListQuery = {
  page: 1,
  pageSize: 10,
  sortBy: 'name',
  sortDirection: 'asc',
};

const emptyMeta: PaginationMeta = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
};

@Injectable({ providedIn: 'root' })
export class CompanyStore {
  private readonly companyApi = inject(CompanyApiService);

  private readonly companiesSignal = signal<Company[]>([]);
  private readonly selectedCompanySignal = signal<Company | null>(null);
  private readonly querySignal = signal<CompanyListQuery>(defaultQuery);
  private readonly metaSignal = signal<PaginationMeta>(emptyMeta);
  private readonly loadingSignal = signal(false);
  private readonly selectedLoadingSignal = signal(false);
  private readonly savingSignal = signal(false);
  private readonly deletingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly formErrorSignal = signal<CompanyApiError | null>(null);

  readonly companies = this.companiesSignal.asReadonly();
  readonly selectedCompany = this.selectedCompanySignal.asReadonly();
  readonly query = this.querySignal.asReadonly();
  readonly meta = this.metaSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly selectedLoading = this.selectedLoadingSignal.asReadonly();
  readonly saving = this.savingSignal.asReadonly();
  readonly deleting = this.deletingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly formError = this.formErrorSignal.asReadonly();
  readonly hasCompanies = computed(() => this.companiesSignal().length > 0);

  loadCompanies(queryPatch: Partial<CompanyListQuery> = {}): Observable<void> {
    const query = { ...this.querySignal(), ...queryPatch };
    this.querySignal.set(query);
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.companyApi.listCompanies(query).pipe(
      tap((result) => {
        this.companiesSignal.set(result.companies);
        this.metaSignal.set(result.meta);
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        const apiError = toCompanyApiError(error);
        this.errorSignal.set(apiError.message);

        return throwError(() => apiError);
      }),
      finalize(() => this.loadingSignal.set(false)),
    );
  }

  loadCompany(companyId: string): Observable<Company> {
    this.selectedLoadingSignal.set(true);
    this.errorSignal.set(null);

    return this.companyApi.getCompany(companyId).pipe(
      tap((company) => this.selectedCompanySignal.set(company)),
      catchError((error: unknown) => {
        const apiError = toCompanyApiError(error);
        this.selectedCompanySignal.set(null);
        this.errorSignal.set(apiError.message);

        return throwError(() => apiError);
      }),
      finalize(() => this.selectedLoadingSignal.set(false)),
    );
  }

  createCompany(payload: CompanyFormValue): Observable<Company> {
    this.savingSignal.set(true);
    this.formErrorSignal.set(null);

    return this.companyApi.createCompany(payload).pipe(
      catchError((error: unknown) => {
        const apiError = toCompanyApiError(error);
        this.formErrorSignal.set(apiError);

        return throwError(() => apiError);
      }),
      finalize(() => this.savingSignal.set(false)),
    );
  }

  updateCompany(companyId: string, payload: CompanyFormValue): Observable<Company> {
    this.savingSignal.set(true);
    this.formErrorSignal.set(null);

    return this.companyApi.updateCompany(companyId, payload).pipe(
      tap((company) => this.selectedCompanySignal.set(company)),
      catchError((error: unknown) => {
        const apiError = toCompanyApiError(error);
        this.formErrorSignal.set(apiError);

        return throwError(() => apiError);
      }),
      finalize(() => this.savingSignal.set(false)),
    );
  }

  deleteCompany(companyId: string): Observable<void> {
    this.deletingSignal.set(true);
    this.errorSignal.set(null);

    return this.companyApi.deleteCompany(companyId).pipe(
      tap(() => {
        this.companiesSignal.update((companies) =>
          companies.filter((company) => company.id !== companyId),
        );
        this.selectedCompanySignal.update((company) =>
          company?.id === companyId ? null : company,
        );
      }),
      catchError((error: unknown) => {
        const apiError = toCompanyApiError(error);
        this.errorSignal.set(apiError.message);

        return throwError(() => apiError);
      }),
      finalize(() => this.deletingSignal.set(false)),
    );
  }

  clearFormError(): void {
    this.formErrorSignal.set(null);
  }
}
