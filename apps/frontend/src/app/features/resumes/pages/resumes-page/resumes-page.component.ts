import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
  TemplateRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { resumeErrorMessage } from '../../data-access/resume-api.service';
import { Resume, resumeFileTypes, resumeMaxBytes } from '../../data-access/resume.models';
import { ResumeStore } from '../../data-access/resume.store';

@Component({
  selector: 'cp-resumes-page',
  imports: [
    DatePipe,
    DecimalPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSnackBarModule,
  ],
  providers: [ResumeStore],
  templateUrl: './resumes-page.component.html',
  styleUrl: './resumes-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumesPageComponent implements OnInit {
  protected readonly store = inject(ResumeStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(160)],
    }),
    file: new FormControl<File | null>(null, Validators.required),
  });
  protected readonly fileError = signal<string | null>(null);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly downloading = signal<string | null>(null);

  ngOnInit(): void {
    this.store.load();
  }

  protected selectFile(input: HTMLInputElement): void {
    const file = input.files?.[0];
    const extension = /\.(pdf|docx)$/i.exec(file?.name ?? '')?.[1]?.toLowerCase();
    const mime = extension === 'pdf' || extension === 'docx' ? resumeFileTypes[extension] : null;
    const error = !file
      ? null
      : !mime || (file.type && file.type !== mime)
        ? 'Choose a PDF or DOCX file.'
        : file.size > resumeMaxBytes
          ? 'Choose a file no larger than 5 MiB.'
          : file.size === 0
            ? 'Choose a file that is not empty.'
            : null;
    this.fileError.set(error);
    this.uploadError.set(null);
    const selected =
      !error && file && mime && !file.type ? new File([file], file.name, { type: mime }) : file;
    this.form.controls.file.setValue(error ? null : (selected ?? null));
    this.form.controls.file.markAsTouched();
    if (error) input.value = '';
  }

  protected upload(input: HTMLInputElement): void {
    if (this.store.loading() || this.store.saving() || this.store.listError()) return;
    const { title, file } = this.form.getRawValue();
    if (this.form.invalid || !file) {
      this.form.markAllAsTouched();
      if (!file && !this.fileError()) this.fileError.set('Select a resume file.');
      return;
    }
    this.uploadError.set(null);
    this.store
      .upload(title.trim(), file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.form.reset();
          input.value = '';
          this.snackBar.open('Resume uploaded.', 'Dismiss', { duration: 3000 });
        },
        error: (error: unknown) =>
          this.uploadError.set(
            resumeErrorMessage(error, 'Could not upload the resume. Try again.'),
          ),
      });
  }

  protected download(resume: Resume): void {
    if (this.downloading()) return;
    this.actionError.set(null);
    this.downloading.set(resume.id);
    this.store
      .download(resume)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.downloading.set(null)),
      )
      .subscribe({
        error: (error: unknown) =>
          this.actionError.set(
            resumeErrorMessage(error, 'Could not download the resume. Try again.'),
          ),
      });
  }

  protected confirmDelete(template: TemplateRef<unknown>, resume: Resume): void {
    this.actionError.set(null);
    this.dialog
      .open(template, { data: resume, width: '420px', autoFocus: 'first-tabbable' })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed: unknown) => {
        if (confirmed !== true) return;
        this.store
          .delete(resume.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              requestAnimationFrame(() => document.getElementById('resume-title')?.focus());
              this.snackBar.open('Resume deleted.', 'Dismiss', { duration: 3000 });
            },
            error: (error: unknown) =>
              this.actionError.set(
                resumeErrorMessage(error, 'Could not delete the resume. Try again.'),
              ),
          });
      });
  }
}
