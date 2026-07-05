import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ContactFormComponent } from '../../components/contact-form/contact-form.component';
import { ContactFormValue } from '../../data-access/contact.models';
import { ContactStore } from '../../data-access/contact.store';

@Component({
  selector: 'cp-contact-edit',
  imports: [ContactFormComponent, MatButtonModule, RouterLink],
  templateUrl: './contact-edit.component.html',
  styleUrl: './contact-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactEditComponent implements OnInit {
  protected readonly contactStore = inject(ContactStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly companyId = this.route.snapshot.paramMap.get('companyId') ?? '';
  protected readonly contactId = this.route.snapshot.paramMap.get('contactId') ?? '';

  ngOnInit(): void {
    this.contactStore
      .loadContact(this.companyId, this.contactId)
      .subscribe({ error: () => undefined });
  }

  protected save(payload: ContactFormValue): void {
    this.contactStore.updateContact(this.companyId, this.contactId, payload).subscribe({
      next: (contact) =>
        void this.router.navigate(['/companies', this.companyId, 'contacts', contact.id]),
      error: () => undefined,
    });
  }

  protected cancel(): void {
    void this.router.navigate(['/companies', this.companyId, 'contacts', this.contactId]);
  }
}
