import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ContactFormComponent } from '../../components/contact-form/contact-form.component';
import { ContactFormValue } from '../../data-access/contact.models';
import { ContactStore } from '../../data-access/contact.store';

@Component({
  selector: 'cp-contact-create',
  imports: [ContactFormComponent, MatButtonModule, RouterLink],
  templateUrl: './contact-create.component.html',
  styleUrl: './contact-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactCreateComponent {
  protected readonly contactStore = inject(ContactStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly companyId = this.route.snapshot.paramMap.get('companyId') ?? '';

  protected save(payload: ContactFormValue): void {
    this.contactStore.createContact(this.companyId, payload).subscribe({
      next: (contact) =>
        void this.router.navigate(['/companies', this.companyId, 'contacts', contact.id]),
      error: () => undefined,
    });
  }

  protected cancel(): void {
    void this.router.navigate(['/companies', this.companyId]);
  }
}
