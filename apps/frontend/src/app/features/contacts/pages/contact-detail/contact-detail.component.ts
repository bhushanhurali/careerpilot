import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ContactDeleteDialogComponent } from '../../components/contact-delete-dialog/contact-delete-dialog.component';
import { Contact } from '../../data-access/contact.models';
import { ContactStore } from '../../data-access/contact.store';

@Component({
  selector: 'cp-contact-detail',
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatSnackBarModule],
  templateUrl: './contact-detail.component.html',
  styleUrl: './contact-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactDetailComponent implements OnInit {
  protected readonly contactStore = inject(ContactStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly companyId = this.route.snapshot.paramMap.get('companyId') ?? '';
  protected readonly contactId = this.route.snapshot.paramMap.get('contactId') ?? '';

  ngOnInit(): void {
    this.contactStore
      .loadContact(this.companyId, this.contactId)
      .subscribe({ error: () => undefined });
  }

  protected fullName(contact: Contact): string {
    return [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  }

  protected deleteContact(): void {
    const contact = this.contactStore.selectedContact();

    if (!contact) {
      return;
    }

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
          void this.router.navigate(['/companies', this.companyId]);
        }
      });
  }
}
