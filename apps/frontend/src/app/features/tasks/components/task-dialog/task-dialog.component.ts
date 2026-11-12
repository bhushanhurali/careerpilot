import { TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';

import { Task, TaskFormValue, TaskPriority, taskPriorities } from '../../data-access/task.models';

export type TaskDialogData =
  | { mode: 'save'; task?: Task; save: (value: TaskFormValue) => Observable<Task> }
  | { mode: 'delete'; task: Task; delete: () => Observable<void> };

@Component({
  selector: 'cp-task-dialog',
  imports: [
    TitleCasePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './task-dialog.component.html',
  styleUrl: './task-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskDialogComponent {
  protected readonly data = inject<TaskDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<TaskDialogComponent, boolean>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly dueDate = viewChild<unknown, ElementRef<HTMLInputElement>>('dueDate', {
    read: ElementRef,
  });

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly priorities = taskPriorities;
  protected readonly form = this.fb.group({
    title: this.fb.control(this.data.task?.title ?? '', [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(160),
    ]),
    notes: this.fb.control(this.data.task?.notes ?? '', Validators.maxLength(10_000)),
    dueOn: this.fb.control(
      this.data.task?.dueOn ?? '',
      Validators.pattern(/^(?!0000)\d{4}-\d{2}-\d{2}$/),
    ),
    priority: this.fb.control<TaskPriority>(this.data.task?.priority ?? 'medium'),
  });

  protected submit(): void {
    if (this.pending()) return;

    const data = this.data;
    if (data.mode === 'save') {
      if (this.dueDate()?.nativeElement.validity.badInput) {
        this.form.controls.dueOn.setErrors({ invalidDate: true });
      }
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        return;
      }
    }

    const value = this.form.getRawValue();
    const notes = value.notes.trim();
    const action: Observable<unknown> =
      data.mode === 'delete'
        ? data.delete()
        : data.save({
            title: value.title.trim(),
            notes: notes === '' ? null : notes,
            dueOn: value.dueOn === '' ? null : value.dueOn,
            priority: value.priority,
          });

    this.pending.set(true);
    this.error.set(null);
    this.ref.disableClose = true;
    this.form.disable();
    action.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.ref.close(true),
      error: (error: unknown) => {
        this.error.set(error instanceof Error ? error.message : 'Task request failed.');
        this.pending.set(false);
        this.ref.disableClose = false;
        this.form.enable();
      },
    });
  }
}
