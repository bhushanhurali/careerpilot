import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CompanyFormValue } from '../../data-access/company.models';
import { CompanyStore } from '../../data-access/company.store';
import { CompanyFormComponent } from '../../components/company-form/company-form.component';

@Component({
  selector: 'cp-company-edit-page',
  imports: [CompanyFormComponent, MatButtonModule, RouterLink],
  templateUrl: './company-edit-page.component.html',
  styleUrl: './company-edit-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyEditPageComponent implements OnInit {
  protected readonly companyStore = inject(CompanyStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected companyId = '';

  ngOnInit(): void {
    this.companyId = this.route.snapshot.paramMap.get('companyId') ?? '';
    this.companyStore.loadCompany(this.companyId).subscribe({ error: () => undefined });
  }

  protected save(payload: CompanyFormValue): void {
    this.companyStore.updateCompany(this.companyId, payload).subscribe({
      next: (company) => void this.router.navigate(['/companies', company.id]),
      error: () => undefined,
    });
  }

  protected cancel(): void {
    void this.router.navigate(['/companies', this.companyId]);
  }
}
