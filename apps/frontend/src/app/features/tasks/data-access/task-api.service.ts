import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

import { ApiResponse } from '../../../core/auth/auth.models';
import { API_BASE_URL } from '../../../core/config/api.config';
import { Task, TaskFormValue, TaskListItem, TaskListQuery, TaskListResult } from './task.models';

@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private readonly http = inject(HttpClient);

  listTasks(query: TaskListQuery): Observable<TaskListResult> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string' || typeof value === 'number') {
        params = params.set(key, value);
      }
    }

    return this.http
      .get<ApiResponse<{ tasks: TaskListItem[] }>>(`${API_BASE_URL}/tasks`, { params })
      .pipe(
        map((response) => ({
          tasks: this.unwrap(response).tasks,
          total: typeof response.meta['total'] === 'number' ? response.meta['total'] : 0,
        })),
        catchError(this.handleError),
      );
  }

  listApplicationTasks(applicationId: string): Observable<TaskListResult> {
    return this.http.get<ApiResponse<{ tasks: Task[] }>>(this.applicationUrl(applicationId)).pipe(
      map((response) => {
        const { tasks } = this.unwrap(response);
        return { tasks, total: tasks.length };
      }),
      catchError(this.handleError),
    );
  }

  createTask(applicationId: string, value: TaskFormValue): Observable<Task> {
    return this.http
      .post<ApiResponse<{ task: Task }>>(this.applicationUrl(applicationId), value)
      .pipe(
        map((response) => this.unwrap(response).task),
        catchError(this.handleError),
      );
  }

  updateTask(
    applicationId: string,
    taskId: string,
    value: Partial<TaskFormValue> & { completed?: boolean },
  ): Observable<Task> {
    return this.http
      .patch<ApiResponse<{ task: Task }>>(`${this.applicationUrl(applicationId)}/${taskId}`, value)
      .pipe(
        map((response) => this.unwrap(response).task),
        catchError(this.handleError),
      );
  }

  deleteTask(applicationId: string, taskId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<{ deleted: boolean }>>(`${this.applicationUrl(applicationId)}/${taskId}`)
      .pipe(
        map((response) => {
          this.unwrap(response);
        }),
        catchError(this.handleError),
      );
  }

  private applicationUrl(applicationId: string): string {
    return `${API_BASE_URL}/applications/${applicationId}/tasks`;
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (!response.success || !response.data) {
      throw new Error(response.error?.message ?? 'Task request failed.');
    }

    return response.data;
  }

  private handleError(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Partial<ApiResponse<never>> | undefined;
      return throwError(() => new Error(body?.error?.message ?? 'Task request failed.'));
    }

    return throwError(() => error);
  }
}
