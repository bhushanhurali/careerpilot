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

import { Company, CompanyFormValue } from '../../data-access/company.models';

const websitePattern = /^https?:\/\/.+/i;

@Component({
  selector: 'cp-company-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './company-form.component.html',
  styleUrl: './company-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyFormComponent implements OnChanges {
  @Input() company: Company | null = null;
  @Input() isSaving = false;
  @Input() submitLabel = 'Save company';
  @Input() errorMessage: string | null = null;

  @Output() saveCompany = new EventEmitter<CompanyFormValue>();
  @Output() cancelForm = new EventEmitter<void>();

  private readonly formBuilder = new FormBuilder();

  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160), this.notBlankValidator]],
    website: ['', [Validators.maxLength(2048), Validators.pattern(websitePattern)]],
    industry: ['', [Validators.maxLength(120)]],
    location: ['', [Validators.maxLength(160)]],
    notes: ['', [Validators.maxLength(10_000)]],
  });

  ngOnChanges(): void {
    if (!this.company) {
      return;
    }

    this.form.patchValue({
      name: this.company.name,
      website: this.company.website ?? '',
      industry: this.company.industry ?? '',
      location: this.company.location ?? '',
      notes: this.company.notes ?? '',
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.isSaving) {
      this.form.markAllAsTouched();

      return;
    }

    this.saveCompany.emit(this.toPayload());
  }

  protected fieldError(field: keyof typeof this.form.controls): string | null {
    const control = this.form.controls[field];

    if (!control.touched || control.valid) {
      return null;
    }

    if (control.hasError('required') || control.hasError('blank')) {
      return 'Company name is required.';
    }

    if (control.hasError('pattern')) {
      return 'Enter a valid URL starting with http:// or https://.';
    }

    return 'Use a shorter value.';
  }

  private toPayload(): CompanyFormValue {
    const value = this.form.getRawValue();

    return {
      name: value.name.trim(),
      website: this.emptyToNull(value.website),
      industry: this.emptyToNull(value.industry),
      location: this.emptyToNull(value.location),
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
