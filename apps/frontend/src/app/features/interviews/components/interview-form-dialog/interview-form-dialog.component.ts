import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';

import {
  Interview,
  InterviewFormValue,
  interviewStatusOptions,
  interviewTypeOptions,
} from '../../data-access/interview.models';

export type InterviewFormDialogData = {
  interview?: Interview;
  saveAction: (payload: InterviewFormValue) => Observable<Interview>;
};

function localDateTime(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return local.toISOString().slice(0, 16);
}

function validateScheduledAt(control: AbstractControl<string>) {
  if (!control.value) {
    return null;
  }

  const date = new Date(control.value);

  return Number.isFinite(date.getTime()) && localDateTime(date) === control.value
    ? null
    : { localDateTime: true };
}

function validateMeetingUrl(control: AbstractControl<string>) {
  const value = control.value.trim();

  if (!value) {
    return null;
  }

  return /^https?:\/\//i.test(value) && URL.canParse(value) ? null : { meetingUrl: true };
}

@Component({
  selector: 'cp-interview-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './interview-form-dialog.component.html',
  styleUrl: './interview-form-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterviewFormDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<InterviewFormDialogComponent, boolean>>(MatDialogRef);
  private readonly data = inject<InterviewFormDialogData>(MAT_DIALOG_DATA);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly initialScheduledAt = this.data.interview
    ? localDateTime(new Date(this.data.interview.scheduledAt))
    : '';

  protected readonly typeOptions = interviewTypeOptions;
  protected readonly statusOptions = interviewStatusOptions;
  protected readonly isEditing = Boolean(this.data.interview);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.formBuilder.group({
    type: this.formBuilder.nonNullable.control<InterviewFormValue['type']>(
      this.data.interview?.type ?? 'recruiter_screen',
      Validators.required,
    ),
    status: this.formBuilder.nonNullable.control<InterviewFormValue['status']>(
      this.data.interview?.status ?? 'scheduled',
      Validators.required,
    ),
    scheduledAt: this.formBuilder.nonNullable.control(this.initialScheduledAt, [
      Validators.required,
      validateScheduledAt,
    ]),
    durationMinutes: this.formBuilder.control(this.data.interview?.durationMinutes ?? null, [
      Validators.min(1),
      Validators.max(2_147_483_647),
      (control: AbstractControl<number | null>) =>
        control.value === null || Number.isInteger(control.value) ? null : { integer: true },
    ]),
    location: this.formBuilder.nonNullable.control(
      this.data.interview?.location ?? '',
      Validators.maxLength(160),
    ),
    meetingUrl: this.formBuilder.nonNullable.control(this.data.interview?.meetingUrl ?? '', [
      Validators.maxLength(2048),
      validateMeetingUrl,
    ]),
    notes: this.formBuilder.nonNullable.control(
      this.data.interview?.notes ?? '',
      Validators.maxLength(10_000),
    ),
  });

  protected submit(): void {
    if (this.isSaving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    const value = this.form.getRawValue();
    const original = this.data.interview;
    // Preserve seconds and the original offset choice when the local input has not changed.
    const scheduledAt =
      original && value.scheduledAt === this.initialScheduledAt
        ? original.scheduledAt
        : new Date(value.scheduledAt).toISOString();
    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.dialogRef.disableClose = true;
    this.form.disable();

    this.data
      .saveAction({
        type: value.type,
        status: value.status,
        scheduledAt,
        durationMinutes: value.durationMinutes,
        location: value.location.trim() || null,
        meetingUrl: value.meetingUrl.trim() || null,
        notes: value.notes.trim() || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (error: unknown) => {
          this.errorMessage.set(
            error instanceof Error ? error.message : 'Could not save interview.',
          );
          this.isSaving.set(false);
          this.dialogRef.disableClose = false;
          this.form.enable();
        },
      });
  }
}
