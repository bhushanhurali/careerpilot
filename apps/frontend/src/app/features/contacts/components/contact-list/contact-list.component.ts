import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
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

import { Contact } from '../../data-access/contact.models';
import { ContactStore } from '../../data-access/contact.store';
import { ContactDeleteDialogComponent } from '../contact-delete-dialog/contact-delete-dialog.component';

@Component({
  selector: 'cp-contact-list',
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
  templateUrl: './contact-list.component.html',
  styleUrl: './contact-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactListComponent implements OnInit, OnChanges {
  @Input({ required: true }) companyId = '';
  @Input() companyName = 'this company';

  protected readonly contactStore = inject(ContactStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly displayedColumns = ['name', 'roleTitle', 'email', 'updatedAt', 'actions'];
  protected readonly filtersForm = this.formBuilder.nonNullable.group({
    search: [''],
  });

  ngOnInit(): void {
    this.filtersForm.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadContacts({ page: 1, search: this.normalizedSearch() });
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['companyId'] && this.companyId) {
      this.loadContacts();
    }
  }

  protected sortChanged(sort: Sort): void {
    this.loadContacts({
      page: 1,
      sortBy: this.toSortBy(sort.active),
      sortDirection: sort.direction === 'asc' ? 'asc' : 'desc',
    });
  }

  protected pageChanged(event: PageEvent): void {
    this.loadContacts({
      page: event.pageIndex + 1,
      pageSize: event.pageSize,
    });
  }

  protected retry(): void {
    this.loadContacts();
  }

  protected clearSearch(): void {
    this.filtersForm.reset({ search: '' });
  }

  protected fullName(contact: Contact): string {
    return [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  }

  protected deleteContact(contact: Contact): void {
    this.dialog
      .open(ContactDeleteDialogComponent, {
        width: '420px',
        data: {
          contactName: this.fullName(contact),
          deleteAction: () => this.contactStore.deleteContact(this.companyId, contact.id),
        },
      })
      .afterClosed()
      .subscribe((deleted) => {
        if (deleted) {
          this.snackBar.open('Contact deleted.', 'Dismiss', { duration: 3000 });
          this.loadContacts();
        }
      });
  }

  private loadContacts(queryPatch = {}): void {
    if (!this.companyId) {
      return;
    }

    this.contactStore.loadContacts(this.companyId, queryPatch).subscribe({
      error: () => undefined,
    });
  }

  private normalizedSearch(): string | undefined {
    const trimmedValue = this.filtersForm.controls.search.value.trim();

    return trimmedValue.length > 0 ? trimmedValue : undefined;
  }

  private toSortBy(active: string) {
    return active === 'firstName' ||
      active === 'lastName' ||
      active === 'createdAt' ||
      active === 'updatedAt'
      ? active
      : 'createdAt';
  }
}
