import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  Interview,
  interviewStatusOptions,
  interviewTypeOptions,
} from '../../data-access/interview.models';
import { InterviewStore } from '../../data-access/interview.store';
import {
  InterviewDeleteDialogComponent,
  InterviewDeleteDialogData,
} from '../interview-delete-dialog/interview-delete-dialog.component';
import {
  InterviewFormDialogComponent,
  InterviewFormDialogData,
} from '../interview-form-dialog/interview-form-dialog.component';

@Component({
  selector: 'cp-interview-list',
  imports: [
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
  ],
  providers: [InterviewStore],
  templateUrl: './interview-list.component.html',
  styleUrl: './interview-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterviewListComponent {
  readonly applicationId = input.required<string>();

  protected readonly store = inject(InterviewStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scheduleButton = viewChild.required<unknown, ElementRef<HTMLButtonElement>>(
    'schedule',
    { read: ElementRef },
  );
  private readonly reloadCount = signal(0);

  constructor() {
    effect((onCleanup) => {
      const applicationId = this.applicationId();
      this.reloadCount();
      const subscription = this.store
        .loadInterviews(applicationId)
        .subscribe({ error: () => undefined });

      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected retry(): void {
    this.reloadCount.update((count) => count + 1);
  }

  protected typeLabel(type: Interview['type']): string {
    return interviewTypeOptions.find((option) => option.value === type)?.label ?? type;
  }

  protected statusLabel(status: Interview['status']): string {
    return interviewStatusOptions.find((option) => option.value === status)?.label ?? status;
  }

  protected openForm(interview?: Interview): void {
    const applicationId = this.applicationId();
    this.dialog
      .open<InterviewFormDialogComponent, InterviewFormDialogData, boolean>(
        InterviewFormDialogComponent,
        {
          width: '560px',
          data: {
            interview,
            saveAction: (payload) =>
              interview
                ? this.store.updateInterview(applicationId, interview.id, payload)
                : this.store.createInterview(applicationId, payload),
          },
        },
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        if (saved) {
          this.refreshAfterChange(interview ? 'Interview updated.' : 'Interview scheduled.');
        }
      });
  }

  protected deleteInterview(interview: Interview): void {
    const applicationId = this.applicationId();
    this.dialog
      .open<InterviewDeleteDialogComponent, InterviewDeleteDialogData, boolean>(
        InterviewDeleteDialogComponent,
        {
          width: '420px',
          autoFocus: 'first-tabbable',
          data: {
            typeLabel: this.typeLabel(interview.type),
            scheduledAt: interview.scheduledAt,
            deleteAction: () => this.store.deleteInterview(applicationId, interview.id),
          },
        },
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((deleted) => {
        if (deleted) {
          this.refreshAfterChange('Interview deleted.');
        }
      });
  }

  private refreshAfterChange(message: string): void {
    this.scheduleButton().nativeElement.focus();
    this.snackBar.open(message, 'Dismiss', { duration: 3000 });
    this.retry();
  }
}
