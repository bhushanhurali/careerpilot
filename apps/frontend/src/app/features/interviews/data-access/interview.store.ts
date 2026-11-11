import { inject, Injectable, signal } from '@angular/core';
import { catchError, defer, finalize, Observable, tap, throwError } from 'rxjs';

import { InterviewApiService } from './interview-api.service';
import { Interview, InterviewFormValue } from './interview.models';

@Injectable()
export class InterviewStore {
  private readonly api = inject(InterviewApiService);
  private readonly interviewsState = signal<Interview[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly interviews = this.interviewsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  loadInterviews(applicationId: string): Observable<Interview[]> {
    return defer(() => {
      this.loadingState.set(true);
      this.errorState.set(null);

      return this.api.listInterviews(applicationId).pipe(
        tap((interviews) => this.interviewsState.set(interviews)),
        catchError((error: unknown) => {
          this.errorState.set(
            error instanceof Error ? error.message : 'Could not load interviews.',
          );

          return throwError(() => error);
        }),
        finalize(() => this.loadingState.set(false)),
      );
    });
  }

  createInterview(applicationId: string, payload: InterviewFormValue): Observable<Interview> {
    return this.api.createInterview(applicationId, payload);
  }

  updateInterview(
    applicationId: string,
    interviewId: string,
    payload: InterviewFormValue,
  ): Observable<Interview> {
    return this.api.updateInterview(applicationId, interviewId, payload);
  }

  deleteInterview(applicationId: string, interviewId: string): Observable<void> {
    return this.api.deleteInterview(applicationId, interviewId);
  }
}
