import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';

export type InterviewDeleteDialogData = {
  typeLabel: string;
  scheduledAt: string;
  deleteAction: () => Observable<void>;
};

@Component({
  selector: 'cp-interview-delete-dialog',
  imports: [DatePipe, MatButtonModule, MatDialogModule],
  templateUrl: './interview-delete-dialog.component.html',
  styleUrl: './interview-delete-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterviewDeleteDialogComponent {
  protected readonly data = inject<InterviewDeleteDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<InterviewDeleteDialogComponent, boolean>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isDeleting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected confirmDelete(): void {
    if (this.isDeleting()) {
      return;
    }

    this.isDeleting.set(true);
    this.errorMessage.set(null);
    this.dialogRef.disableClose = true;
    this.data
      .deleteAction()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (error: unknown) => {
          this.errorMessage.set(
            error instanceof Error ? error.message : 'Could not delete interview.',
          );
          this.isDeleting.set(false);
          this.dialogRef.disableClose = false;
        },
      });
  }
}
