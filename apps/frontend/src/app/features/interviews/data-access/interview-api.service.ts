import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

import { ApiResponse } from '../../../core/auth/auth.models';
import { API_BASE_URL } from '../../../core/config/api.config';
import { Interview, InterviewFormValue } from './interview.models';

@Injectable({ providedIn: 'root' })
export class InterviewApiService {
  private readonly http = inject(HttpClient);

  listInterviews(applicationId: string): Observable<Interview[]> {
    return this.http
      .get<ApiResponse<{ interviews: Interview[] }>>(this.interviewsUrl(applicationId))
      .pipe(
        map((response) => this.unwrap(response).interviews),
        catchError(this.handleError),
      );
  }

  createInterview(applicationId: string, payload: InterviewFormValue): Observable<Interview> {
    return this.http
      .post<ApiResponse<{ interview: Interview }>>(this.interviewsUrl(applicationId), payload)
      .pipe(
        map((response) => this.unwrap(response).interview),
        catchError(this.handleError),
      );
  }

  updateInterview(
    applicationId: string,
    interviewId: string,
    payload: InterviewFormValue,
  ): Observable<Interview> {
    return this.http
      .patch<
        ApiResponse<{ interview: Interview }>
      >(`${this.interviewsUrl(applicationId)}/${interviewId}`, payload)
      .pipe(
        map((response) => this.unwrap(response).interview),
        catchError(this.handleError),
      );
  }

  deleteInterview(applicationId: string, interviewId: string): Observable<void> {
    return this.http
      .delete<
        ApiResponse<{ deleted: boolean }>
      >(`${this.interviewsUrl(applicationId)}/${interviewId}`)
      .pipe(
        map((response) => {
          this.unwrap(response);
        }),
        catchError(this.handleError),
      );
  }

  private interviewsUrl(applicationId: string): string {
    return `${API_BASE_URL}/applications/${applicationId}/interviews`;
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (!response.success || !response.data) {
      throw new Error(response.error?.message ?? 'Interview request failed.');
    }

    return response.data;
  }

  private handleError(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Partial<ApiResponse<never>> | undefined;

      return throwError(() => new Error(body?.error?.message ?? 'Interview request failed.'));
    }

    return throwError(() => error);
  }
}
