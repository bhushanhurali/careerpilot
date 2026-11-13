import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from '../../../core/auth/auth.interceptor';
import { AuthStore } from '../../../core/auth/auth.store';
import { API_BASE_URL } from '../../../core/config/api.config';
import { ResumeApiService } from './resume-api.service';

describe('ResumeApiService', () => {
  const base = `${API_BASE_URL}/resumes`;
  let api: ResumeApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { accessToken: () => 'test-token' } },
      ],
    });
    api = TestBed.inject(ResumeApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uploads multipart data without overriding the browser-generated content type', () => {
    const file = new File(['pdf'], 'resume.pdf', { type: 'application/pdf' });
    api.uploadResume('Engineering', file).subscribe();
    const req = http.expectOne({ method: 'POST', url: base });
    expect(req.request.body.get('title')).toBe('Engineering');
    expect(req.request.body.get('file')).toBe(file);
    expect(req.request.headers.has('Content-Type')).toBeFalse();
    req.flush({ success: true, data: { resume: { id: 'resume-1' } } });
  });

  it('fetches the file as a blob through the bearer interceptor', () => {
    const file = new Blob(['pdf'], { type: 'application/pdf' });
    api.downloadResume('resume-1').subscribe((result) => expect(result).toBe(file));
    const req = http.expectOne({ method: 'GET', url: `${base}/resume-1/download` });
    expect(req.request.responseType).toBe('blob');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    req.flush(file);
  });
});
