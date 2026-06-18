/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import { RegisterPageComponent } from './register-page.component';

describe('RegisterPageComponent', () => {
  let fixture: ComponentFixture<RegisterPageComponent>;
  let authStore: jasmine.SpyObj<AuthStore>;

  beforeEach(async () => {
    authStore = jasmine.createSpyObj<AuthStore>('AuthStore', ['register']);

    await TestBed.configureTestingModule({
      imports: [RegisterPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: authStore,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterPageComponent);
    fixture.detectChanges();
  });

  it('requires first name, last name, email, and password before submitting', () => {
    componentApi().submit();

    expect(componentApi().form.invalid).toBeTrue();
    expect(componentApi().form.controls['firstName'].hasError('required')).toBeTrue();
    expect(componentApi().form.controls['lastName'].hasError('required')).toBeTrue();
    expect(componentApi().form.controls['email'].hasError('required')).toBeTrue();
    expect(componentApi().form.controls['password'].hasError('required')).toBeTrue();
    expect(authStore.register).not.toHaveBeenCalled();
  });

  it('validates email format and minimum password length', () => {
    componentApi().form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'not-an-email',
      password: 'short',
    });

    expect(componentApi().form.invalid).toBeTrue();
    expect(componentApi().form.controls['email'].hasError('email')).toBeTrue();
    expect(componentApi().form.controls['password'].hasError('minlength')).toBeTrue();
  });

  function componentApi(): { form: FormGroup; submit: () => void } {
    return fixture.componentInstance as unknown as { form: FormGroup; submit: () => void };
  }
});
