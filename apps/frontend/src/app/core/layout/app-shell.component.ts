import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  selector: 'cp-app-shell',
  imports: [MatToolbarModule],
  template: `
    <mat-toolbar color="primary">
      <span>CareerPilot</span>
    </mat-toolbar>

    <main class="app-shell__content">
      <h1>CareerPilot foundation is ready.</h1>
      <p>Phase 0 contains infrastructure only. Business features start in later phases.</p>
    </main>
  `,
  styles: [
    `
      .app-shell__content {
        width: min(960px, calc(100% - 32px));
        margin: 48px auto;
      }

      h1 {
        margin: 0 0 12px;
        font-size: 2rem;
        font-weight: 600;
      }

      p {
        margin: 0;
        color: #52616f;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {}
