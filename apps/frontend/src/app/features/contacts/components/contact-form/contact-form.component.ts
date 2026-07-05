import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { Contact, ContactFormValue } from '../../data-access/contact.models';

const linkedInUrlPattern = /^https?:\/\/.+/i;

@Component({
  selector: 'cp-contact-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './contact-form.component.html',
  styleUrl: './contact-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactFormComponent implements OnChanges {
  @Input() contact: Contact | null = null;
  @Input() isSaving = false;
  @Input() submitLabel = 'Save contact';
  @Input() errorMessage: string | null = null;

  @Output() saveContact = new EventEmitter<ContactFormValue>();
  @Output() cancelForm = new EventEmitter<void>();

  private readonly formBuilder = new FormBuilder();

  protected readonly form = this.formBuilder.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(80), this.notBlankValidator]],
    lastName: ['', [Validators.maxLength(80)]],
    email: ['', [Validators.email, Validators.maxLength(320)]],
    phone: ['', [Validators.maxLength(40)]],
    roleTitle: ['', [Validators.maxLength(120)]],
    linkedInUrl: ['', [Validators.maxLength(2048), Validators.pattern(linkedInUrlPattern)]],
    notes: ['', [Validators.maxLength(10_000)]],
  });

  ngOnChanges(): void {
    if (!this.contact) {
      return;
    }

    this.form.patchValue({
      firstName: this.contact.firstName,
      lastName: this.contact.lastName ?? '',
      email: this.contact.email ?? '',
      phone: this.contact.phone ?? '',
      roleTitle: this.contact.roleTitle ?? '',
      linkedInUrl: this.contact.linkedInUrl ?? '',
      notes: this.contact.notes ?? '',
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();

      return;
    }

    this.saveContact.emit(this.toPayload());
  }

  protected fieldError(field: keyof typeof this.form.controls): string | null {
    const control = this.form.controls[field];

    if (!control.touched || control.valid) {
      return null;
    }

    if (control.hasError('required') || control.hasError('blank')) {
      return 'First name is required.';
    }

    if (control.hasError('email')) {
      return 'Enter a valid email address.';
    }

    if (control.hasError('pattern')) {
      return 'Enter a valid URL starting with http:// or https://.';
    }

    return 'Use a shorter value.';
  }

  private toPayload(): ContactFormValue {
    const value = this.form.getRawValue();

    return {
      firstName: value.firstName.trim(),
      lastName: this.emptyToNull(value.lastName),
      email: this.emptyToNull(value.email),
      phone: this.emptyToNull(value.phone),
      roleTitle: this.emptyToNull(value.roleTitle),
      linkedInUrl: this.emptyToNull(value.linkedInUrl),
      notes: this.emptyToNull(value.notes),
    };
  }

  private emptyToNull(value: string): string | null {
    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private notBlankValidator(control: { value: string }) {
    return control.value.trim().length > 0 ? null : { blank: true };
  }
}
