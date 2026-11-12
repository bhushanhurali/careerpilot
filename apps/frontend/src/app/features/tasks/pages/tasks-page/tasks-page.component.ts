import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { map, tap } from 'rxjs';

import { TaskListComponent } from '../../components/task-list/task-list.component';
import { TaskApiService } from '../../data-access/task-api.service';
import {
  localCalendarDate,
  TaskDueFilter,
  TaskListQuery,
  TaskPriority,
  taskPriorities,
  TaskSort,
} from '../../data-access/task.models';
import { TaskStore } from '../../data-access/task.store';

const taskViews = [
  { value: 'all', label: 'All tasks' },
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'undated', label: 'No due date' },
] as const;

@Component({
  selector: 'cp-tasks-page',
  imports: [
    TitleCasePipe,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatPaginatorModule,
    TaskListComponent,
  ],
  providers: [TaskStore],
  templateUrl: './tasks-page.component.html',
  styleUrl: './tasks-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksPageComponent {
  protected readonly store = inject(TaskStore);
  private readonly api = inject(TaskApiService);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly views = taskViews;
  protected readonly priorities = taskPriorities;
  protected readonly pagination = signal({ page: 1, pageSize: 20 });

  protected readonly filters = this.fb.group({
    view: this.fb.control<'all' | 'open' | 'completed' | TaskDueFilter>('all'),
    priority: this.fb.control<'all' | TaskPriority>('all'),
    sortBy: this.fb.control<TaskSort>('dueOn'),
    sortDirection: this.fb.control<'asc' | 'desc'>('asc'),
  });
  private readonly filterValues = toSignal(
    this.filters.valueChanges.pipe(
      tap(() => this.pagination.update((current) => ({ ...current, page: 1 }))),
      map(() => this.filters.getRawValue()),
    ),
    { initialValue: this.filters.getRawValue() },
  );

  constructor() {
    effect((onCleanup) => {
      this.store.revision();
      const { view, priority, sortBy, sortDirection } = this.filterValues();
      const pagination = this.pagination();
      const query: TaskListQuery = { ...pagination, sortBy, sortDirection };
      if (priority !== 'all') query.priority = priority;
      if (view === 'open' || view === 'completed') {
        query.status = view;
      } else if (view !== 'all') {
        query.due = view;
        if (view !== 'undated') query.today = localCalendarDate();
      }

      const subscription = this.store.load(this.api.listTasks(query)).subscribe(({ total }) => {
        const lastPage = Math.max(1, Math.ceil(total / pagination.pageSize));
        if (pagination.page > lastPage) this.pagination.set({ ...pagination, page: lastPage });
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected pageChanged(event: PageEvent): void {
    this.pagination.set({ page: event.pageIndex + 1, pageSize: event.pageSize });
  }
}
