import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { productBrand } from '../../../core/config/product-brand';
import { ThemeSwitcherComponent } from '../../../core/theme/theme-switcher.component';

@Component({
  selector: 'cp-auth-layout',
  imports: [MatIconModule, ThemeSwitcherComponent, RouterLink],
  templateUrl: './auth-layout.component.html',
  styleUrl: './auth-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent {
  protected readonly brand = productBrand;
  readonly heading = input.required<string>();
}
