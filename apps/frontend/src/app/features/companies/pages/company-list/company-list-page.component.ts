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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { Company } from '../../data-access/company.models';
import { CompanyStore } from '../../data-access/company.store';
import { CompanyDeleteDialogComponent } from '../../components/company-delete-dialog/company-delete-dialog.component';

@Component({
  selector: 'cp-company-list-page',
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
    MatSnackBarModule,
    MatSortModule,
    MatTableModule,
  ],
  templateUrl: './company-list-page.component.html',
  styleUrl: './company-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyListPageComponent implements OnInit {
  protected readonly companyStore = inject(CompanyStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly displayedColumns = ['name', 'industry', 'location', 'updatedAt', 'actions'];
  protected readonly filtersForm = this.formBuilder.nonNullable.group({
    search: [''],
    industry: [''],
    location: [''],
  });

  ngOnInit(): void {
    this.loadCompanies();
    this.filtersForm.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadCompanies({ page: 1, ...this.normalizedFilters() });
      });
  }

  protected sortChanged(sort: Sort): void {
    this.loadCompanies({
      page: 1,
      sortBy: this.toSortBy(sort.active),
      sortDirection: sort.direction === 'desc' ? 'desc' : 'asc',
    });
  }

  protected pageChanged(event: PageEvent): void {
    this.loadCompanies({
      page: event.pageIndex + 1,
      pageSize: event.pageSize,
    });
  }

  protected retry(): void {
    this.loadCompanies();
  }

  protected clearFilters(): void {
    this.filtersForm.reset({
      search: '',
      industry: '',
      location: '',
    });
  }

  protected deleteCompany(company: Company): void {
    this.dialog
      .open(CompanyDeleteDialogComponent, {
        width: '420px',
        data: {
          companyName: company.name,
          deleteAction: () => this.companyStore.deleteCompany(company.id),
        },
      })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.snackBar.open('Company deleted.', 'Dismiss', { duration: 3000 });
          this.loadCompanies();
        }
      });
  }

  private loadCompanies(queryPatch = {}): void {
    this.companyStore.loadCompanies(queryPatch).subscribe({
      error: () => undefined,
    });
  }

  private normalizedFilters() {
    const value = this.filtersForm.getRawValue();

    return {
      search: this.emptyToUndefined(value.search),
      industry: this.emptyToUndefined(value.industry),
      location: this.emptyToUndefined(value.location),
    };
  }

  private emptyToUndefined(value: string): string | undefined {
    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : undefined;
  }

  private toSortBy(active: string) {
    return active === 'industry' || active === 'location' || active === 'updatedAt'
      ? active
      : 'name';
  }
}
