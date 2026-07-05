import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ApplicationFormComponent } from '../../components/application-form/application-form.component';
import { ApplicationFormValue } from '../../data-access/application.models';
import { ApplicationStore } from '../../data-access/application.store';

@Component({
  selector: 'cp-application-edit-page',
  imports: [ApplicationFormComponent, MatButtonModule, RouterLink],
  templateUrl: './application-edit-page.component.html',
  styleUrl: './application-edit-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationEditPageComponent implements OnInit {
  protected readonly applicationStore = inject(ApplicationStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly applicationId = this.route.snapshot.paramMap.get('applicationId') ?? '';

  ngOnInit(): void {
    this.applicationStore.loadApplication(this.applicationId).subscribe({ error: () => undefined });
  }

  protected save(payload: ApplicationFormValue): void {
    this.applicationStore.updateApplication(this.applicationId, payload).subscribe({
      next: (application) => void this.router.navigate(['/applications', application.id]),
      error: () => undefined,
    });
  }

  protected cancel(): void {
    void this.router.navigate(['/applications', this.applicationId]);
  }
}
