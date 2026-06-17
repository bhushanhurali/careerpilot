import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';

@Component({
  selector: 'cp-register-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
})
export class RegisterPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly hidePassword = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.formBuilder.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(12)]],
  });

  protected readonly firstNameError = computed(() =>
    this.fieldError('firstName', 'First name is required.'),
  );

  protected readonly lastNameError = computed(() =>
    this.fieldError('lastName', 'Last name is required.'),
  );

  protected readonly emailError = computed(() => {
    const control = this.form.controls.email;

    if (!control.touched || control.valid) {
      return null;
    }

    return control.hasError('email') ? 'Enter a valid email address.' : 'Email is required.';
  });

  protected readonly passwordError = computed(() => {
    const control = this.form.controls.password;

    if (!control.touched || control.valid) {
      return null;
    }

    return control.hasError('minlength')
      ? 'Password must be at least 12 characters.'
      : 'Password is required.';
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.authStore.register(this.form.getRawValue()).subscribe({
      next: () => {
        void this.router.navigateByUrl('/');
      },
      error: (error: unknown) => {
        this.errorMessage.set(error instanceof Error ? error.message : 'Registration failed.');
        this.isSubmitting.set(false);
      },
    });
  }

  private fieldError(
    controlName: 'firstName' | 'lastName',
    requiredMessage: string,
  ): string | null {
    const control = this.form.controls[controlName];

    if (!control.touched || control.valid) {
      return null;
    }

    return control.hasError('maxlength') ? 'Use 100 characters or fewer.' : requiredMessage;
  }
}
