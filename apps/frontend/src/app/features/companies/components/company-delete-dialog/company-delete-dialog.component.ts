import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable } from 'rxjs';

export type CompanyDeleteDialogData = {
  companyName: string;
  deleteAction: () => Observable<void>;
};

@Component({
  selector: 'cp-company-delete-dialog',
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatProgressSpinnerModule],
  templateUrl: './company-delete-dialog.component.html',
  styleUrl: './company-delete-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyDeleteDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<CompanyDeleteDialogComponent, boolean>>(MatDialogRef);
  protected readonly data = inject<CompanyDeleteDialogData>(MAT_DIALOG_DATA);

  protected readonly isDeleting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected cancel(): void {
    this.dialogRef.close(false);
  }

  protected confirmDelete(): void {
    this.isDeleting.set(true);
    this.errorMessage.set(null);

    this.data.deleteAction().subscribe({
      next: () => this.dialogRef.close(true),
      error: (error: unknown) => {
        this.errorMessage.set(error instanceof Error ? error.message : 'Delete failed.');
        this.isDeleting.set(false);
      },
    });
  }
}
