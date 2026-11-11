import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { TaskApiService } from '../../data-access/task-api.service';
import { Task } from '../../data-access/task.models';
import { TaskStore } from '../../data-access/task.store';
import { TaskDialogComponent, TaskDialogData } from '../task-dialog/task-dialog.component';
import { TaskListComponent } from '../task-list/task-list.component';

@Component({
  selector: 'cp-application-tasks',
  imports: [TaskListComponent, MatButtonModule, MatDialogModule, MatIconModule],
  providers: [TaskStore],
  templateUrl: './application-tasks.component.html',
  styleUrl: './application-tasks.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationTasksComponent {
  readonly applicationId = input.required<string>();
  private readonly api = inject(TaskApiService);
  private readonly store = inject(TaskStore);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect((onCleanup) => {
      const applicationId = this.applicationId();
      this.store.revision();
      const subscription = this.store
        .load(this.api.listApplicationTasks(applicationId))
        .subscribe();
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected openForm(task?: Task): void {
    const applicationId = this.applicationId();
    this.openDialog(
      {
        mode: 'save',
        task,
        save: (value) =>
          task
            ? this.api.updateTask(applicationId, task.id, value)
            : this.api.createTask(applicationId, value),
      },
      task ? 'Task updated.' : 'Task created.',
    );
  }

  protected confirmDelete(task: Task): void {
    this.openDialog(
      {
        mode: 'delete',
        task,
        delete: () => this.api.deleteTask(task.applicationId, task.id),
      },
      'Task deleted.',
    );
  }

  private openDialog(data: TaskDialogData, message: string): void {
    this.dialog
      .open<TaskDialogComponent, TaskDialogData, boolean>(TaskDialogComponent, {
        data,
        width: data.mode === 'delete' ? '420px' : '480px',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((changed) => {
        if (changed) this.store.refresh(message);
      });
  }
}
