import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';

import { ApplicationFormComponent } from '../../components/application-form/application-form.component';
import { ApplicationFormValue } from '../../data-access/application.models';
import { ApplicationStore } from '../../data-access/application.store';

@Component({
  selector: 'cp-application-create-page',
  imports: [ApplicationFormComponent, MatButtonModule, RouterLink],
  templateUrl: './application-create-page.component.html',
  styleUrl: './application-create-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationCreatePageComponent {
  protected readonly applicationStore = inject(ApplicationStore);
  private readonly router = inject(Router);

  protected save(payload: ApplicationFormValue): void {
    this.applicationStore.createApplication(payload).subscribe({
      next: (application) => void this.router.navigate(['/applications', application.id]),
      error: () => undefined,
    });
  }

  protected cancel(): void {
    void this.router.navigate(['/applications']);
  }
}
