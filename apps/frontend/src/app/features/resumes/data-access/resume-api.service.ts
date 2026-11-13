import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';

import type { ApiResponse } from '../../../core/auth/auth.models';
import { API_BASE_URL } from '../../../core/config/api.config';
import type { Resume } from './resume.models';

@Injectable({ providedIn: 'root' })
export class ResumeApiService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_BASE_URL}/resumes`;

  listResumes() {
    return this.http
      .get<ApiResponse<{ resumes: Resume[] }>>(this.url)
      .pipe(map((response) => this.unwrap(response).resumes));
  }

  uploadResume(title: string, file: File) {
    const body = new FormData();
    body.set('title', title);
    body.set('file', file);
    return this.http
      .post<ApiResponse<{ resume: Resume }>>(this.url, body)
      .pipe(map((response) => this.unwrap(response).resume));
  }

  downloadResume(id: string) {
    return this.http.get(`${this.url}/${id}/download`, { responseType: 'blob' });
  }

  deleteResume(id: string) {
    return this.http
      .delete<ApiResponse<{ deleted: true }>>(`${this.url}/${id}`)
      .pipe(map((response) => this.unwrap(response)));
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (!response.success || !response.data) throw new Error('Resume request failed.');
    return response.data;
  }
}

export function resumeErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  switch (error.status) {
    case 404:
      return 'This resume is no longer available.';
    case 413:
      return 'Choose a file no larger than 5 MiB.';
    case 415:
      return 'Choose a PDF or DOCX file with a matching extension and file type.';
    case 422:
      switch ((error.error as ApiResponse<never> | null)?.error?.code) {
        case 'RESUME_ENCRYPTED':
          return 'Choose a resume that is not password-protected.';
        case 'RESUME_NO_TEXT':
          return 'Choose a resume with selectable text. Scanned documents are not supported.';
        case 'RESUME_TOO_COMPLEX':
          return 'This document is too complex to process. Try a simpler copy.';
        default:
          return 'Could not read this document. Try another PDF or DOCX.';
      }
    case 400:
      return 'Check the title and filename, and select one PDF or DOCX.';
    default:
      return fallback;
  }
}
