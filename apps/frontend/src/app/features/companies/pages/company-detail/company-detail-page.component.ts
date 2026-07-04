import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { CompanyStore } from '../../data-access/company.store';
import { CompanyDeleteDialogComponent } from '../../components/company-delete-dialog/company-delete-dialog.component';

@Component({
  selector: 'cp-company-detail-page',
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatSnackBarModule],
  templateUrl: './company-detail-page.component.html',
  styleUrl: './company-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyDetailPageComponent implements OnInit {
  protected readonly companyStore = inject(CompanyStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected companyId = '';

  ngOnInit(): void {
    this.companyId = this.route.snapshot.paramMap.get('companyId') ?? '';
    this.companyStore.loadCompany(this.companyId).subscribe({ error: () => undefined });
  }

  protected deleteCompany(): void {
    const company = this.companyStore.selectedCompany();

    if (!company) {
      return;
    }

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
          void this.router.navigate(['/companies']);
        }
      });
  }
}
