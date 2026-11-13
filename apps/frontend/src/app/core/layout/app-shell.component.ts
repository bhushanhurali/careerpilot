import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthStore } from '../auth/auth.store';
import { NotificationStore } from '../../features/notifications/data-access/notification.store';

@Component({
  selector: 'cp-app-shell',
  imports: [
    MatButtonModule,
    MatBadgeModule,
    MatIconModule,
    MatToolbarModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  templateUrl: './app-shell.component.html',
  providers: [NotificationStore],
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  protected readonly authStore = inject(AuthStore);
  protected readonly notificationStore = inject(NotificationStore);

  protected logout(): void {
    this.authStore.logout().subscribe();
  }
}
