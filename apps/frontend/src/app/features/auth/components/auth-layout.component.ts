import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { ThemeSwitcherComponent } from '../../../core/theme/theme-switcher.component';

@Component({
  selector: 'cp-auth-layout',
  imports: [MatIconModule, ThemeSwitcherComponent],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent {
  readonly heading = input.required<string>();
}
