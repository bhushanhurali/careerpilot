import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';

import {
  ApplicationStatus,
  ApplicationStatusTransitionValue,
  applicationStatusOptions,
} from '../../data-access/application.models';

export type ApplicationStatusTransitionDialogData = {
  currentStatus: ApplicationStatus;
  transitionAction: (payload: ApplicationStatusTransitionValue) => Observable<unknown>;
};

@Component({
  selector: 'cp-application-status-transition-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './application-status-transition-dialog.component.html',
  styleUrl: './application-status-transition-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationStatusTransitionDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<ApplicationStatusTransitionDialogComponent, boolean>>(MatDialogRef);
  protected readonly data = inject<ApplicationStatusTransitionDialogData>(MAT_DIALOG_DATA);
  private readonly formBuilder = new FormBuilder();

  protected readonly statusOptions = applicationStatusOptions.filter(
    (status) => status.value !== this.data.currentStatus,
  );
  protected isSaving = false;
  protected errorMessage: string | null = null;

  protected readonly form = this.formBuilder.nonNullable.group({
    status: [this.statusOptions[0]?.value ?? this.data.currentStatus, [Validators.required]],
    note: ['', [Validators.maxLength(10_000)]],
  });

  protected cancel(): void {
    this.dialogRef.close(false);
  }

  protected submit(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();

      return;
    }

    this.isSaving = true;
    this.errorMessage = null;

    this.data.transitionAction(this.toPayload()).subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.errorMessage = error instanceof Error ? error.message : 'Status change failed.';
        this.isSaving = false;
      },
    });
  }

  protected fieldError(): string | null {
    const note = this.form.controls.note;

    return note.touched && note.hasError('maxlength') ? 'Use a shorter note.' : null;
  }

  private toPayload(): ApplicationStatusTransitionValue {
    const value = this.form.getRawValue();
    const note = value.note.trim();

    return {
      status: value.status,
      note: note.length > 0 ? note : null,
    };
  }
}
