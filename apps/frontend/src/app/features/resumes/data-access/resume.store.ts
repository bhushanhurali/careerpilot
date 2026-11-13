import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, tap } from 'rxjs';

import { ResumeApiService } from './resume-api.service';
import type { Resume } from './resume.models';

@Injectable()
export class ResumeStore {
  private readonly api = inject(ResumeApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly items = signal<Resume[]>([]);
  private readonly loadingState = signal(false);
  private readonly listErrorState = signal<string | null>(null);
  private readonly savingState = signal(false);
  readonly resumes = this.items.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly listError = this.listErrorState.asReadonly();
  readonly saving = this.savingState.asReadonly();

  load(): void {
    if (this.loading() || this.saving()) return;
    this.loadingState.set(true);
    this.listErrorState.set(null);
    this.api
      .listResumes()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingState.set(false)),
      )
      .subscribe({
        next: (resumes) => this.items.set(resumes),
        error: () => this.listErrorState.set('Could not load resumes.'),
      });
  }

  upload(title: string, file: File) {
    this.savingState.set(true);
    return this.api.uploadResume(title, file).pipe(
      tap((resume) => this.items.update((resumes) => [resume, ...resumes])),
      finalize(() => this.savingState.set(false)),
    );
  }

  delete(id: string) {
    this.savingState.set(true);
    return this.api.deleteResume(id).pipe(
      tap(() => this.items.update((resumes) => resumes.filter((resume) => resume.id !== id))),
      finalize(() => this.savingState.set(false)),
    );
  }

  download(resume: Resume) {
    return this.api.downloadResume(resume.id).pipe(
      tap((blob) => {
        const url = URL.createObjectURL(blob);
        try {
          const link = document.createElement('a');
          link.href = url;
          link.download = resume.originalFilename;
          link.click();
        } finally {
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      }),
    );
  }
}
