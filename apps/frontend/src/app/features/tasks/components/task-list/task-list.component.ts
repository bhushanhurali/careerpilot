import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { localCalendarDate, Task } from '../../data-access/task.models';
import { TaskStore } from '../../data-access/task.store';

@Component({
  selector: 'cp-task-list',
  imports: [TitleCasePipe, RouterLink, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskListComponent {
  readonly manageable = input(false);
  readonly editTask = output<Task>();
  readonly deleteTask = output<Task>();
  protected readonly store = inject(TaskStore);

  protected dueLabel(task: Task): string | null {
    if (!task.dueOn || task.completedAt) return null;

    const today = localCalendarDate();
    if (task.dueOn < today) return 'Overdue';

    return task.dueOn === today ? 'Due today' : null;
  }
}
