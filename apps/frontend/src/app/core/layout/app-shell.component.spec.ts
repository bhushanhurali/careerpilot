import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSidenav } from '@angular/material/sidenav';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { NotificationStore } from '../../features/notifications/data-access/notification.store';
import { AuthStore } from '../auth/auth.store';
import { AppShellComponent } from './app-shell.component';

@Component({ selector: 'cp-test-destination', template: '' })
class TestDestinationComponent {}

describe('AppShellComponent', () => {
  const breakpoint = new BehaviorSubject({ matches: false, breakpoints: {} });
  const logout = jasmine.createSpy('logout').and.returnValue(of(undefined));

  beforeEach(() => {
    breakpoint.next({ matches: false, breakpoints: {} });
    TestBed.configureTestingModule({
      imports: [AppShellComponent, NoopAnimationsModule],
      providers: [
        provideRouter([{ path: 'dashboard', component: TestDestinationComponent }]),
        {
          provide: BreakpointObserver,
          useValue: { observe: () => breakpoint, isMatched: () => breakpoint.value.matches },
        },
        {
          provide: AuthStore,
          useValue: { status: () => 'authenticated', displayName: () => 'Ada', logout },
        },
      ],
    }).overrideComponent(AppShellComponent, {
      set: { providers: [{ provide: NotificationStore, useValue: { unreadCount: signal(3) } }] },
    });
  });

  it('keeps work routes in desktop navigation and account actions in the top bar', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const routes = Array.from(element.querySelectorAll('nav a'), (link) =>
      link.getAttribute('href'),
    );
    expect(routes).toEqual(['/dashboard', '/companies', '/applications', '/tasks', '/resumes']);
    expect(
      element.querySelector('[aria-label="Notifications, 3 unread"]')?.getAttribute('href'),
    ).toBe('/notifications');
    expect(element.querySelector('cp-theme-switcher')).not.toBeNull();
    element.querySelector<HTMLButtonElement>('[aria-label="Sign out"]')?.click();
    expect(logout).toHaveBeenCalled();
  });

  it('opens compact navigation on demand and closes it when a destination is selected', async () => {
    breakpoint.next({ matches: true, breakpoints: {} });
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const drawer = fixture.debugElement.query(By.directive(MatSidenav)).injector.get(MatSidenav);
    const trigger = element.querySelector<HTMLButtonElement>('[aria-label="Open navigation"]');
    expect(drawer.mode).toBe('over');
    expect(drawer.opened).toBeFalse();
    trigger?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    element.querySelector<HTMLAnchorElement>('nav a')?.click();
    await fixture.whenStable();
    expect(drawer.opened).toBeFalse();
  });
});
