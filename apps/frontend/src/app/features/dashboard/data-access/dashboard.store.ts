import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { DashboardApiService } from './dashboard-api.service';
import { Dashboard } from './dashboard.models';

@Injectable()
export class DashboardStore {
  private readonly api = inject(DashboardApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dashboardState = signal<Dashboard | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly dashboard = this.dashboardState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  load(): void {
    if (this.loading()) return;

    this.loadingState.set(true);
    this.errorState.set(null);
    this.api
      .getDashboard()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingState.set(false)),
      )
      .subscribe({
        next: (dashboard) => this.dashboardState.set(dashboard),
        error: (error: unknown) => {
          this.errorState.set(
            error instanceof Error ? error.message : 'Could not load the dashboard.',
          );
        },
      });
  }
}
