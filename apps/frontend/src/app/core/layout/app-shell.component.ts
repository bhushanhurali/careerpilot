import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';

import { AuthStore } from '../auth/auth.store';

@Component({
  selector: 'cp-app-shell',
  imports: [MatButtonModule, MatIconModule, MatToolbarModule],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  protected readonly authStore = inject(AuthStore);

  protected logout(): void {
    this.authStore.logout().subscribe();
  }
}
