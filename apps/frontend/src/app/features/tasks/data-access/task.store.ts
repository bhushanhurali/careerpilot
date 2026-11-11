import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, defer, EMPTY, finalize, Observable, tap } from 'rxjs';

import { TaskApiService } from './task-api.service';
import { Task, TaskListItem, TaskListResult } from './task.models';

@Injectable()
export class TaskStore {
  private readonly api = inject(TaskApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tasksState = signal<TaskListItem[]>([]);
  private readonly totalState = signal(0);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly actionErrorState = signal<string | null>(null);
  private readonly successState = signal<string | null>(null);
  private readonly pendingState = signal<string | null>(null);
  private readonly revisionState = signal(0);

  readonly tasks = this.tasksState.asReadonly();
  readonly total = this.totalState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly actionError = this.actionErrorState.asReadonly();
  readonly success = this.successState.asReadonly();
  readonly pending = this.pendingState.asReadonly();
  readonly revision = this.revisionState.asReadonly();

  load(request: Observable<TaskListResult>): Observable<TaskListResult> {
    return defer(() => {
      this.loadingState.set(true);
      this.errorState.set(null);
      return request.pipe(
        tap(({ tasks, total }) => {
          this.tasksState.set(tasks);
          this.totalState.set(total);
        }),
        catchError((error: unknown) => {
          this.errorState.set(error instanceof Error ? error.message : 'Could not load tasks.');
          return EMPTY;
        }),
        finalize(() => this.loadingState.set(false)),
      );
    });
  }

  refresh(message?: string): void {
    this.actionErrorState.set(null);
    this.successState.set(message ?? null);
    this.revisionState.update((revision) => revision + 1);
  }

  toggleCompletion(task: Task): void {
    if (this.pending()) return;

    const completed = task.completedAt === null;
    this.pendingState.set(task.id);
    this.actionErrorState.set(null);
    this.successState.set(null);
    this.api
      .updateTask(task.applicationId, task.id, { completed })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.pendingState.set(null)),
      )
      .subscribe({
        next: () => this.refresh(completed ? 'Task completed.' : 'Task reopened.'),
        error: (error: unknown) => {
          this.actionErrorState.set(
            error instanceof Error ? error.message : 'Could not update task.',
          );
        },
      });
  }
}
