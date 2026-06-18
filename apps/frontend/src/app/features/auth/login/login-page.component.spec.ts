/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

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

  function componentApi(): { form: FormGroup; submit: () => void } {
    return fixture.componentInstance as unknown as { form: FormGroup; submit: () => void };
  }
});
