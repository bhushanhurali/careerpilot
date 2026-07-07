import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, tap, throwError } from 'rxjs';

import {
  ApplicationApiError,
  ApplicationApiService,
  toApplicationApiError,
} from './application-api.service';
import {
  ApplicationFormValue,
  ApplicationListQuery,
  ApplicationPaginationMeta,
  ApplicationStatusHistoryEntry,
  ApplicationStatusTransitionValue,
  ApplicationUpdateValue,
  JobApplication,
} from './application.models';

const defaultQuery: ApplicationListQuery = {
  page: 1,
  pageSize: 10,
  sortBy: 'updatedAt',
  sortDirection: 'desc',
};

const emptyMeta: ApplicationPaginationMeta = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
};

@Injectable({ providedIn: 'root' })
export class ApplicationStore {
  private readonly applicationApi = inject(ApplicationApiService);

  private readonly applicationsSignal = signal<JobApplication[]>([]);
  private readonly selectedApplicationSignal = signal<JobApplication | null>(null);
  private readonly statusHistorySignal = signal<ApplicationStatusHistoryEntry[]>([]);
  private readonly querySignal = signal<ApplicationListQuery>(defaultQuery);
  private readonly metaSignal = signal<ApplicationPaginationMeta>(emptyMeta);
  private readonly loadingSignal = signal(false);
  private readonly selectedLoadingSignal = signal(false);
  private readonly statusHistoryLoadingSignal = signal(false);
  private readonly statusTransitionSavingSignal = signal(false);
  private readonly savingSignal = signal(false);
  private readonly deletingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);
  private readonly statusHistoryErrorSignal = signal<string | null>(null);
  private readonly statusTransitionErrorSignal = signal<ApplicationApiError | null>(null);
  private readonly formErrorSignal = signal<ApplicationApiError | null>(null);

  readonly applications = this.applicationsSignal.asReadonly();
  readonly selectedApplication = this.selectedApplicationSignal.asReadonly();
  readonly statusHistory = this.statusHistorySignal.asReadonly();
  readonly query = this.querySignal.asReadonly();
  readonly meta = this.metaSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly selectedLoading = this.selectedLoadingSignal.asReadonly();
  readonly statusHistoryLoading = this.statusHistoryLoadingSignal.asReadonly();
  readonly statusTransitionSaving = this.statusTransitionSavingSignal.asReadonly();
  readonly saving = this.savingSignal.asReadonly();
  readonly deleting = this.deletingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly statusHistoryError = this.statusHistoryErrorSignal.asReadonly();
  readonly statusTransitionError = this.statusTransitionErrorSignal.asReadonly();
  readonly formError = this.formErrorSignal.asReadonly();
  readonly hasApplications = computed(() => this.applicationsSignal().length > 0);

  loadApplications(queryPatch: Partial<ApplicationListQuery> = {}): Observable<void> {
    const query = { ...this.querySignal(), ...queryPatch };
    this.querySignal.set(query);
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.applicationApi.listApplications(query).pipe(
      tap((result) => {
        this.applicationsSignal.set(result.applications);
        this.metaSignal.set(result.meta);
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        const apiError = toApplicationApiError(error);
        this.errorSignal.set(apiError.message);

        return throwError(() => apiError);
      }),
      finalize(() => this.loadingSignal.set(false)),
    );
  }

  loadApplication(applicationId: string): Observable<JobApplication> {
    this.selectedLoadingSignal.set(true);
    this.errorSignal.set(null);
    this.statusHistorySignal.set([]);
    this.statusHistoryErrorSignal.set(null);

    return this.applicationApi.getApplication(applicationId).pipe(
      tap((application) => this.selectedApplicationSignal.set(application)),
      catchError((error: unknown) => {
        const apiError = toApplicationApiError(error);
        this.selectedApplicationSignal.set(null);
        this.errorSignal.set(apiError.message);

        return throwError(() => apiError);
      }),
      finalize(() => this.selectedLoadingSignal.set(false)),
    );
  }

  loadStatusHistory(applicationId: string): Observable<ApplicationStatusHistoryEntry[]> {
    this.statusHistoryLoadingSignal.set(true);
    this.statusHistoryErrorSignal.set(null);

    return this.applicationApi.listStatusHistory(applicationId).pipe(
      tap((statusHistory) => this.statusHistorySignal.set(statusHistory)),
      catchError((error: unknown) => {
        const apiError = toApplicationApiError(error);
        this.statusHistorySignal.set([]);
        this.statusHistoryErrorSignal.set(apiError.message);

        return throwError(() => apiError);
      }),
      finalize(() => this.statusHistoryLoadingSignal.set(false)),
    );
  }

  createApplication(payload: ApplicationFormValue): Observable<JobApplication> {
    this.savingSignal.set(true);
    this.formErrorSignal.set(null);

    return this.applicationApi.createApplication(payload).pipe(
      catchError((error: unknown) => {
        const apiError = toApplicationApiError(error);
        this.formErrorSignal.set(apiError);

        return throwError(() => apiError);
      }),
      finalize(() => this.savingSignal.set(false)),
    );
  }

  updateApplication(
    applicationId: string,
    payload: ApplicationUpdateValue,
  ): Observable<JobApplication> {
    this.savingSignal.set(true);
    this.formErrorSignal.set(null);

    return this.applicationApi.updateApplication(applicationId, payload).pipe(
      tap((application) => this.selectedApplicationSignal.set(application)),
      catchError((error: unknown) => {
        const apiError = toApplicationApiError(error);
        this.formErrorSignal.set(apiError);

        return throwError(() => apiError);
      }),
      finalize(() => this.savingSignal.set(false)),
    );
  }

  createStatusTransition(
    applicationId: string,
    payload: ApplicationStatusTransitionValue,
  ): Observable<JobApplication> {
    this.statusTransitionSavingSignal.set(true);
    this.statusTransitionErrorSignal.set(null);

    return this.applicationApi.createStatusTransition(applicationId, payload).pipe(
      tap((result) => {
        this.selectedApplicationSignal.set(result.application);
        this.statusHistorySignal.update((statusHistory) => [...statusHistory, result.historyEntry]);
        this.applicationsSignal.update((applications) =>
          applications.map((application) =>
            application.id === result.application.id ? result.application : application,
          ),
        );
      }),
      map((result) => result.application),
      catchError((error: unknown) => {
        const apiError = toApplicationApiError(error);
        this.statusTransitionErrorSignal.set(apiError);

        return throwError(() => apiError);
      }),
      finalize(() => this.statusTransitionSavingSignal.set(false)),
    );
  }

  deleteApplication(applicationId: string): Observable<void> {
    this.deletingSignal.set(true);
    this.errorSignal.set(null);

    return this.applicationApi.deleteApplication(applicationId).pipe(
      tap(() => {
        this.applicationsSignal.update((applications) =>
          applications.filter((application) => application.id !== applicationId),
        );
        this.selectedApplicationSignal.update((application) =>
          application?.id === applicationId ? null : application,
        );
      }),
      catchError((error: unknown) => {
        const apiError = toApplicationApiError(error);
        this.errorSignal.set(apiError.message);

        return throwError(() => apiError);
      }),
      finalize(() => this.deletingSignal.set(false)),
    );
  }

  clearFormError(): void {
    this.formErrorSignal.set(null);
  }

  clearStatusTransitionError(): void {
    this.statusTransitionErrorSignal.set(null);
  }
}
