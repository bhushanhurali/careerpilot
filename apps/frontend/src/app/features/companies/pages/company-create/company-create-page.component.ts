import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';

import { CompanyFormValue } from '../../data-access/company.models';
import { CompanyStore } from '../../data-access/company.store';
import { CompanyFormComponent } from '../../components/company-form/company-form.component';

@Component({
  selector: 'cp-company-create-page',
  imports: [CompanyFormComponent, MatButtonModule, RouterLink],
  templateUrl: './company-create-page.component.html',
  styleUrl: './company-create-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyCreatePageComponent {
  protected readonly companyStore = inject(CompanyStore);
  private readonly router = inject(Router);

  protected save(payload: CompanyFormValue): void {
    this.companyStore.createCompany(payload).subscribe({
      next: (company) => void this.router.navigate(['/companies', company.id]),
      error: () => undefined,
    });
  }

  protected cancel(): void {
    void this.router.navigate(['/companies']);
  }
}
