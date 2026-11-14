import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

import { AuthStore } from '../auth/auth.store';
import { ThemeSwitcherComponent } from '../theme/theme-switcher.component';
import { NotificationStore } from '../../features/notifications/data-access/notification.store';

@Component({
  selector: 'cp-app-shell',
  imports: [
    MatButtonModule,
    MatBadgeModule,
    MatIconModule,
    MatSidenavModule,
    MatTooltipModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ThemeSwitcherComponent,
  ],
  templateUrl: './app-shell.component.html',
  providers: [NotificationStore],
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly compactViewport = '(width < 1024px)';
  protected readonly compact = toSignal(
    this.breakpoints.observe(this.compactViewport).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(this.compactViewport) },
  );
  protected readonly destinations = [
    { path: '/dashboard', label: 'Dashboard', icon: 'space_dashboard' },
    { path: '/companies', label: 'Companies', icon: 'business' },
    { path: '/applications', label: 'Applications', icon: 'work_outline' },
    { path: '/tasks', label: 'Tasks', icon: 'checklist' },
    { path: '/resumes', label: 'Resumes', icon: 'description' },
  ];
  protected readonly authStore = inject(AuthStore);
  protected readonly notificationStore = inject(NotificationStore);

  protected closeNavigation(navigation: MatSidenav): void {
    if (this.compact()) void navigation.close();
  }

  protected logout(): void {
    this.authStore.logout().subscribe();
  }
}
