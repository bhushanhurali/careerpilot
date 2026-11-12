import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

import { ApiResponse } from '../../../core/auth/auth.models';
import { API_BASE_URL } from '../../../core/config/api.config';
import { localCalendarDate } from '../../tasks/data-access/task.models';
import { Dashboard } from './dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);

  getDashboard(): Observable<Dashboard> {
    return this.http
      .get<ApiResponse<Dashboard>>(`${API_BASE_URL}/dashboard`, {
        params: { today: localCalendarDate() },
      })
      .pipe(
        map((response) => {
          if (!response.success || !response.data) {
            throw new Error(response.error?.message ?? 'Could not load the dashboard.');
          }
          return response.data;
        }),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse) {
            const response = error.error as Partial<ApiResponse<never>> | undefined;
            return throwError(
              () => new Error(response?.error?.message ?? 'Could not load the dashboard.'),
            );
          }
          return throwError(() => error);
        }),
      );
  }
}
