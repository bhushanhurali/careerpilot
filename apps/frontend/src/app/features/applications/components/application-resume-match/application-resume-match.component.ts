import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { ResumeStore } from '../../../resumes/data-access/resume.store';
import {
  ApplicationApiService,
  toApplicationApiError,
} from '../../data-access/application-api.service';
import type { ApplicationResumeMatch } from '../../data-access/application.models';

@Component({
  selector: 'cp-application-resume-match',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatSelectModule, RouterLink],
  providers: [ResumeStore],
  templateUrl: './application-resume-match.component.html',
  styleUrl: './application-resume-match.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationResumeMatchComponent implements OnInit {
  readonly applicationId = input.required<string>();
  protected readonly resumes = inject(ResumeStore);
  private readonly api = inject(ApplicationApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly resumeId = new FormControl('', {
    nonNullable: true,
    validators: Validators.required,
  });
  protected readonly form = new FormGroup({ resumeId: this.resumeId });
  protected readonly matching = signal(false);
  protected readonly result = signal<ApplicationResumeMatch | null>(null);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.resumes.load();
    this.resumeId.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.result.set(null);
      this.error.set(null);
    });
  }

  protected compare(): void {
    if (this.matching() || this.resumeId.invalid) return;

    this.matching.set(true);
    this.result.set(null);
    this.error.set(null);
    this.resumeId.disable({ emitEvent: false });
    this.api
      .compareResume(this.applicationId(), this.resumeId.value)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.matching.set(false);
          this.resumeId.enable({ emitEvent: false });
        }),
      )
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error: unknown) => {
          const { code } = toApplicationApiError(error);
          switch (code) {
            case 'JOB_DESCRIPTION_REQUIRED':
              this.error.set('Add a job description before comparing.');
              break;
            case 'RESUME_TEXT_UNAVAILABLE':
              this.error.set('This resume has no extracted text. Select another resume.');
              break;
            case 'RESUME_NOT_FOUND':
              this.resumeId.reset();
              this.resumes.load();
              this.error.set('That resume is no longer available.');
              break;
            case 'APPLICATION_NOT_FOUND':
              this.error.set('This application is no longer available.');
              break;
            default:
              this.error.set('Could not compare this resume. Try again.');
          }
        },
      });
  }
}
