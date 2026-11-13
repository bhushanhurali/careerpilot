import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { API_BASE_URL } from '../../../../core/config/api.config';
import { ResumeApiService } from '../../../resumes/data-access/resume-api.service';
import { ApplicationResumeMatchComponent } from './application-resume-match.component';

describe('ApplicationResumeMatchComponent', () => {
  const url = `${API_BASE_URL}/applications/app-1/resume-match`;

  async function setup() {
    const listResumes = jasmine.createSpy().and.returnValues(
      throwError(() => new HttpErrorResponse({ status: 500 })),
      of([{ id: 'r1', title: 'Engineering', originalFilename: 'resume.pdf' }]),
    );
    TestBed.configureTestingModule({
      imports: [ApplicationResumeMatchComponent, NoopAnimationsModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ResumeApiService, useValue: { listResumes } },
      ],
    });
    const fixture = TestBed.createComponent(ApplicationResumeMatchComponent);
    fixture.componentRef.setInput('applicationId', 'app-1');
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Could not load resumes.');
    element.querySelector('button')?.click();
    fixture.detectChanges();
    const select = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);
    await select.clickOptions({ text: 'Engineering (resume.pdf)' });

    return { fixture, element, http: TestBed.inject(HttpTestingController) };
  }

  it('retries the resume list and renders the returned coverage and skills', async () => {
    const { fixture, element, http } = await setup();
    element
      .querySelector('button[type="submit"]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const req = http.expectOne({ method: 'POST', url });
    expect(req.request.body).toEqual({ resumeId: 'r1' });
    fixture.detectChanges();
    expect(element.textContent).toContain('Comparing resume...');
    req.flush({
      success: true,
      data: {
        match: {
          status: 'compared',
          coveragePercentage: 50,
          matchedCount: 1,
          requiredCount: 2,
          matchedSkills: ['TypeScript'],
          missingSkills: ['Docker'],
        },
      },
    });
    fixture.detectChanges();
    expect(element.textContent).toContain('50% skill coverage');
    expect(element.textContent).toContain('TypeScript');
    expect(element.textContent).toContain('Docker');
    http.verify();
  });

  it('explains unavailable text and distinguishes no recognized requirements from zero coverage', async () => {
    const { fixture, element, http } = await setup();
    const compare = () =>
      element.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    compare();
    http
      .expectOne(url)
      .flush(
        { error: { code: 'RESUME_TEXT_UNAVAILABLE' } },
        { status: 422, statusText: 'Unprocessable' },
      );
    fixture.detectChanges();
    expect(element.textContent).toContain('has no extracted text');
    compare();
    http.expectOne(url).flush({
      success: true,
      data: {
        match: {
          status: 'no_recognized_requirements',
          coveragePercentage: null,
          requiredCount: 0,
          matchedSkills: [],
          missingSkills: [],
          matchedCount: 0,
        },
      },
    });
    fixture.detectChanges();
    expect(element.textContent).toContain('Coverage is unavailable');
    expect(element.textContent).not.toContain('0%');
    http.verify();
  });
});
