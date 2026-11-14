/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';

import { AuthStore } from '../../../core/auth/auth.store';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let authStore: jasmine.SpyObj<AuthStore>;

  beforeEach(async () => {
    authStore = jasmine.createSpyObj<AuthStore>('AuthStore', ['login']);

    await TestBed.configureTestingModule({
      imports: [LoginPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: authStore,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();
  });

  it('requires email and password before submitting', () => {
    componentApi().submit();

    expect(componentApi().form.invalid).toBeTrue();
    expect(componentApi().form.controls['email'].hasError('required')).toBeTrue();
    expect(componentApi().form.controls['password'].hasError('required')).toBeTrue();
    expect(authStore.login).not.toHaveBeenCalled();
  });

  it('validates email format', () => {
    componentApi().form.controls['email'].setValue('not-an-email');
    componentApi().form.controls['password'].setValue('long-secure-password');

    expect(componentApi().form.invalid).toBeTrue();
    expect(componentApi().form.controls['email'].hasError('email')).toBeTrue();
  });

  it('updates field feedback after submission and announces sign-in failures', () => {
    const element: HTMLElement = fixture.nativeElement;
    const form = componentApi().form;
    componentApi().submit();
    fixture.detectChanges();
    expect(element.textContent).toContain('Email is required.');
    form.controls['email'].setValue('not-an-email');
    fixture.detectChanges();
    expect(element.textContent).toContain('Enter a valid email address.');
    form.setValue({ email: 'ada@example.com', password: 'password' });
    authStore.login.and.returnValue(throwError(() => new Error('Sign in failed.')));
    componentApi().submit();
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Sign in failed.');
    expect(element.querySelector('h1')?.textContent).toBe('Sign in');
  });

  function componentApi(): { form: FormGroup; submit: () => void } {
    return fixture.componentInstance as unknown as { form: FormGroup; submit: () => void };
  }
});
