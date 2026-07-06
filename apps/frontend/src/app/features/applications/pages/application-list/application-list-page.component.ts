import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { ApplicationDeleteDialogComponent } from '../../components/application-delete-dialog/application-delete-dialog.component';
import {
  applicationPriorityOptions,
  applicationStatusOptions,
  JobApplication,
} from '../../data-access/application.models';
import { ApplicationStore } from '../../data-access/application.store';

@Component({
  selector: 'cp-application-list-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
  ],
  templateUrl: './application-list-page.component.html',
  styleUrl: './application-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationListPageComponent implements OnInit {
  protected readonly applicationStore = inject(ApplicationStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly displayedColumns = [
    'jobTitle',
    'company',
    'status',
    'priority',
    'updatedAt',
    'actions',
  ];
  protected readonly statusOptions = applicationStatusOptions;
  protected readonly priorityOptions = applicationPriorityOptions;
  protected readonly filtersForm = this.formBuilder.nonNullable.group({
    search: [''],
    status: [''],
    priority: [''],
    source: [''],
    location: [''],
  });

  ngOnInit(): void {
    this.loadApplications();
    this.filtersForm.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadApplications({ page: 1, ...this.normalizedFilters() });
      });
  }

  protected sortChanged(sort: Sort): void {
    this.loadApplications({
      page: 1,
      sortBy: this.toSortBy(sort.active),
      sortDirection: sort.direction === 'asc' ? 'asc' : 'desc',
    });
  }

  protected pageChanged(event: PageEvent): void {
    this.loadApplications({
      page: event.pageIndex + 1,
      pageSize: event.pageSize,
    });
  }

  protected retry(): void {
    this.loadApplications();
  }

  protected clearFilters(): void {
    this.filtersForm.reset({
      search: '',
      status: '',
      priority: '',
      source: '',
      location: '',
    });
  }

  protected deleteApplication(application: JobApplication): void {
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
          this.loadApplications();
        }
      });
  }

  private loadApplications(queryPatch = {}): void {
    this.applicationStore.loadApplications(queryPatch).subscribe({
      error: () => undefined,
    });
  }

  private normalizedFilters() {
    const value = this.filtersForm.getRawValue();

    return {
      search: this.emptyToUndefined(value.search),
      status: this.emptyToUndefined(value.status),
      priority: this.emptyToUndefined(value.priority),
      source: this.emptyToUndefined(value.source),
      location: this.emptyToUndefined(value.location),
    };
  }

  private emptyToUndefined(value: string): string | undefined {
    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : undefined;
  }

  private toSortBy(active: string) {
    return active === 'jobTitle' ||
      active === 'status' ||
      active === 'priority' ||
      active === 'companyName' ||
      active === 'appliedAt' ||
      active === 'createdAt'
      ? active
      : 'updatedAt';
  }
}
