import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApplicationDeleteDialogComponent } from '../../components/application-delete-dialog/application-delete-dialog.component';
import { ApplicationStatusTransitionDialogComponent } from '../../components/application-status-transition-dialog/application-status-transition-dialog.component';
import {
  ApplicationStatus,
  ApplicationStatusTransitionValue,
  applicationStatusOptions,
  JobApplication,
} from '../../data-access/application.models';
import { ApplicationStore } from '../../data-access/application.store';

@Component({
  selector: 'cp-application-detail-page',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  templateUrl: './application-detail-page.component.html',
  styleUrl: './application-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationDetailPageComponent implements OnInit {
  protected readonly applicationStore = inject(ApplicationStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly applicationId = this.route.snapshot.paramMap.get('applicationId') ?? '';

  ngOnInit(): void {
    this.applicationStore.loadApplication(this.applicationId).subscribe({ error: () => undefined });
    this.applicationStore
      .loadStatusHistory(this.applicationId)
      .subscribe({ error: () => undefined });
  }

  protected statusLabel(status: ApplicationStatus): string {
    return applicationStatusOptions.find((option) => option.value === status)?.label ?? status;
  }

  protected contactName(application: JobApplication): string {
    if (!application.contact) {
      return '-';
    }

    return [application.contact.firstName, application.contact.lastName].filter(Boolean).join(' ');
  }

  protected salary(application: JobApplication): string {
    if (application.salaryMin === null && application.salaryMax === null) {
      return '-';
    }

    const currency = application.salaryCurrency ? ` ${application.salaryCurrency}` : '';

    if (application.salaryMin !== null && application.salaryMax !== null) {
      return `${application.salaryMin} - ${application.salaryMax}${currency}`;
    }

    return `${application.salaryMin ?? application.salaryMax}${currency}`;
  }

  protected deleteApplication(): void {
    const application = this.applicationStore.selectedApplication();

    if (!application) {
      return;
    }

    this.dialog
      .open(ApplicationDeleteDialogComponent, {
        width: '420px',
        data: {
          jobTitle: application.jobTitle,
          deleteAction: () => this.applicationStore.deleteApplication(application.id),
        },
      })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.snackBar.open('Application deleted.', 'Dismiss', { duration: 3000 });
          void this.router.navigate(['/applications']);
        }
      });
  }

  protected changeStatus(): void {
    const application = this.applicationStore.selectedApplication();

    if (!application) {
      return;
    }

    this.applicationStore.clearStatusTransitionError();
    this.dialog
      .open(ApplicationStatusTransitionDialogComponent, {
        width: '460px',
        data: {
          currentStatus: application.status,
          transitionAction: (payload: ApplicationStatusTransitionValue) =>
            this.applicationStore.createStatusTransition(application.id, payload),
        },
      })
      .afterClosed()
      .subscribe((changed) => {
        if (changed) {
          this.snackBar.open('Status updated.', 'Dismiss', { duration: 3000 });
        }
      });
  }

  protected retryStatusHistory(): void {
    this.applicationStore
      .loadStatusHistory(this.applicationId)
      .subscribe({ error: () => undefined });
  }
}
