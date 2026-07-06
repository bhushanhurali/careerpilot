import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';

import { Company } from '../../../companies/data-access/company.models';
import { CompanyApiService } from '../../../companies/data-access/company-api.service';
import { Contact } from '../../../contacts/data-access/contact.models';
import { ContactApiService } from '../../../contacts/data-access/contact-api.service';
import {
  ApplicationFormValue,
  applicationPriorityOptions,
  applicationStatusOptions,
  JobApplication,
} from '../../data-access/application.models';

const urlPattern = /^https?:\/\/.+/i;

@Component({
  selector: 'cp-application-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './application-form.component.html',
  styleUrl: './application-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationFormComponent implements OnInit, OnChanges {
  @Input() application: JobApplication | null = null;
  @Input() isSaving = false;
  @Input() submitLabel = 'Save application';
  @Input() errorMessage: string | null = null;

  @Output() saveApplication = new EventEmitter<ApplicationFormValue>();
  @Output() cancelForm = new EventEmitter<void>();

  private readonly formBuilder = new FormBuilder();
  private readonly destroyRef = inject(DestroyRef);
  private readonly companyApi = inject(CompanyApiService);
  private readonly contactApi = inject(ContactApiService);

  protected readonly statusOptions = applicationStatusOptions;
  protected readonly priorityOptions = applicationPriorityOptions;
  protected companies: Company[] = [];
  protected contacts: Contact[] = [];
  protected loadingCompanies = false;
  protected loadingContacts = false;
  protected optionsError: string | null = null;

  protected readonly form = this.formBuilder.nonNullable.group({
    companyId: ['', [Validators.required]],
    contactId: [''],
    jobTitle: ['', [Validators.required, Validators.maxLength(160), this.notBlankValidator]],
    jobUrl: ['', [Validators.maxLength(2048), Validators.pattern(urlPattern)]],
    source: ['', [Validators.maxLength(120)]],
    status: ['draft' as ApplicationFormValue['status'], [Validators.required]],
    priority: ['medium' as ApplicationFormValue['priority'], [Validators.required]],
    salaryMin: [null as number | null, [Validators.min(0)]],
    salaryMax: [null as number | null, [Validators.min(0)]],
    salaryCurrency: ['', [Validators.pattern(/^[A-Za-z]{3}$/)]],
    location: ['', [Validators.maxLength(160)]],
    employmentType: ['', [Validators.maxLength(80)]],
    workMode: ['', [Validators.maxLength(80)]],
    appliedAt: [''],
    notes: ['', [Validators.maxLength(10_000)]],
  });

  ngOnInit(): void {
    this.loadCompanies();
    this.form.controls.companyId.valueChanges
      .pipe(
        tap(() => this.form.controls.contactId.setValue('')),
        switchMap((companyId) => this.loadContacts(companyId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['application'] || !this.application) {
      return;
    }

    this.form.patchValue(
      {
        companyId: this.application.companyId,
        contactId: this.application.contactId ?? '',
        jobTitle: this.application.jobTitle,
        jobUrl: this.application.jobUrl ?? '',
        source: this.application.source ?? '',
        status: this.application.status,
        priority: this.application.priority,
        salaryMin: this.application.salaryMin,
        salaryMax: this.application.salaryMax,
        salaryCurrency: this.application.salaryCurrency ?? '',
        location: this.application.location ?? '',
        employmentType: this.application.employmentType ?? '',
        workMode: this.application.workMode ?? '',
        appliedAt: this.application.appliedAt ?? '',
        notes: this.application.notes ?? '',
      },
      { emitEvent: false },
    );
    void this.loadContacts(
      this.application.companyId,
      this.application.contactId ?? '',
    ).subscribe();
  }

  protected submit(): void {
    if (this.form.invalid || this.isSaving || !this.hasValidSalary()) {
      this.form.markAllAsTouched();

      return;
    }

    this.saveApplication.emit(this.toPayload());
  }

  protected fieldError(field: keyof typeof this.form.controls): string | null {
    const control = this.form.controls[field];

    if (!control.touched || control.valid) {
      return null;
    }

    if (control.hasError('required') || control.hasError('blank')) {
      return field === 'companyId' ? 'Company is required.' : 'Job title is required.';
    }

    if (control.hasError('pattern')) {
      return field === 'salaryCurrency'
        ? 'Use a 3-letter currency code.'
        : 'Enter a valid URL starting with http:// or https://.';
    }

    if (control.hasError('min')) {
      return 'Use a positive value.';
    }

    return 'Use a shorter value.';
  }

  protected salaryError(): string | null {
    const value = this.form.getRawValue();

    if (value.salaryMin !== null && value.salaryMax !== null && value.salaryMin > value.salaryMax) {
      return 'Minimum salary must be less than or equal to maximum salary.';
    }

    if ((value.salaryMin !== null || value.salaryMax !== null) && !value.salaryCurrency.trim()) {
      return 'Currency is required when salary is provided.';
    }

    return null;
  }

  protected contactLabel(contact: Contact): string {
    return [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  }

  private loadCompanies(): void {
    this.loadingCompanies = true;
    this.optionsError = null;

    this.companyApi
      .listCompanies({
        page: 1,
        pageSize: 100,
        sortBy: 'name',
        sortDirection: 'asc',
      })
      .pipe(
        tap((result) => (this.companies = result.companies)),
        catchError(() => {
          this.optionsError = 'Could not load companies.';

          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => (this.loadingCompanies = false));
  }

  private loadContacts(companyId: string, keepContactId = '') {
    if (!companyId) {
      this.contacts = [];

      return of(null);
    }

    this.loadingContacts = true;
    this.optionsError = null;

    return this.contactApi
      .listContacts(companyId, {
        page: 1,
        pageSize: 100,
        sortBy: 'firstName',
        sortDirection: 'asc',
      })
      .pipe(
        tap((result) => {
          this.contacts = result.contacts;
          const selectedContactId = keepContactId || this.form.controls.contactId.value;
          const contactStillValid = this.contacts.some(
            (contact) => contact.id === selectedContactId,
          );

          if (selectedContactId && contactStillValid) {
            this.form.controls.contactId.setValue(selectedContactId, { emitEvent: false });
          } else if (selectedContactId) {
            this.form.controls.contactId.setValue('', { emitEvent: false });
          }
        }),
        catchError(() => {
          this.optionsError = 'Could not load contacts for the selected company.';

          return of(null);
        }),
        finalize(() => (this.loadingContacts = false)),
      );
  }

  private toPayload(): ApplicationFormValue {
    const value = this.form.getRawValue();

    return {
      companyId: value.companyId,
      contactId: this.emptyToNull(value.contactId),
      jobTitle: value.jobTitle.trim(),
      jobUrl: this.emptyToNull(value.jobUrl),
      source: this.emptyToNull(value.source),
      status: value.status,
      priority: value.priority,
      salaryMin: value.salaryMin,
      salaryMax: value.salaryMax,
      salaryCurrency: this.emptyToNull(value.salaryCurrency)?.toUpperCase() ?? null,
      location: this.emptyToNull(value.location),
      employmentType: this.emptyToNull(value.employmentType),
      workMode: this.emptyToNull(value.workMode),
      appliedAt: this.emptyToNull(value.appliedAt),
      notes: this.emptyToNull(value.notes),
    };
  }

  private hasValidSalary(): boolean {
    return this.salaryError() === null;
  }

  private emptyToNull(value: string): string | null {
    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private notBlankValidator(control: { value: string }) {
    return control.value.trim().length > 0 ? null : { blank: true };
  }
}
