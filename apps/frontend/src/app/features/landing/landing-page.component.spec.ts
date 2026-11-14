import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { AuthStore } from '../../core/auth/auth.store';
import { productBrand } from '../../core/config/product-brand';
import { LandingPageComponent } from './landing-page.component';

describe('Public landing routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [
        provideRouter(routes),
        {
          provide: AuthStore,
          useValue: { status: () => 'anonymous', isAuthenticated: () => false },
        },
      ],
    });
  });

  it('renders the public page with clearly labeled sample data and auth CTAs', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', LandingPageComponent);
    const page = harness.routeNativeElement;
    expect(page?.querySelector('h1')?.textContent).toBe(productBrand.name);
    expect(page?.textContent).toContain('Illustrative preview with sample data');
    expect(page?.textContent).toContain('How it works');
    expect(page?.textContent).toContain('deterministic coverage');
    expect(page?.querySelector('a[href="/login"]')?.textContent?.trim()).toBe('Login');
    expect(page?.querySelector('a[href="/register"]')?.textContent?.trim()).toBe('Get Started');
  });

  it('resolves both public auth aliases to the existing forms', async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    await harness.navigateByUrl('/login');
    expect(router.url).toBe('/auth/login');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Sign in');
    await harness.navigateByUrl('/register');
    expect(router.url).toBe('/auth/register');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Create account');
  });
});
