import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';

import { ResumeApiService } from '../../data-access/resume-api.service';
import { Resume, resumeMaxBytes } from '../../data-access/resume.models';
import { ResumesPageComponent } from './resumes-page.component';

describe('ResumesPageComponent', () => {
  let fixture: ComponentFixture<ResumesPageComponent>;
  let api: jasmine.SpyObj<ResumeApiService>;
  const resume: Resume = {
    id: 'r1',
    title: 'Engineering',
    originalFilename: 'resume.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 100,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  beforeEach(() => {
    api = jasmine.createSpyObj('ResumeApiService', ['listResumes', 'uploadResume', 'deleteResume']);
    api.listResumes.and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [ResumesPageComponent, NoopAnimationsModule],
      providers: [
        { provide: ResumeApiService, useValue: api },
        { provide: MatSnackBar, useValue: jasmine.createSpyObj('MatSnackBar', ['open']) },
      ],
    });
    fixture = TestBed.createComponent(ResumesPageComponent);
    fixture.detectChanges();
  });

  function select(file: File): void {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#resume-file');
    const files = new DataTransfer();
    files.items.add(file);
    input.files = files.files;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function submit(): void {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('blocks an oversized file before making a request', () => {
    select(
      new File([new Uint8Array(resumeMaxBytes + 1)], 'large.pdf', { type: 'application/pdf' }),
    );
    submit();
    expect(fixture.nativeElement.textContent).toContain('Choose a file no larger than 5 MiB.');
    expect(api.uploadResume).not.toHaveBeenCalled();
  });

  it('preserves inputs after a parsing error, then adds a successful upload to the list', () => {
    const title: HTMLInputElement = fixture.nativeElement.querySelector('#resume-title');
    title.value = ' Engineering ';
    title.dispatchEvent(new Event('input'));
    select(new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }));
    api.uploadResume.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { error: { code: 'RESUME_NO_TEXT' } },
          }),
      ),
    );
    submit();
    expect(fixture.nativeElement.textContent).toContain('selectable text');
    expect(title.value).toBe(' Engineering ');
    api.uploadResume.and.returnValue(of(resume));
    submit();
    expect(api.uploadResume).toHaveBeenCalledWith('Engineering', jasmine.any(File));
    expect(fixture.nativeElement.textContent).toContain('resume.pdf');
    expect(title.value).toBe('');
  });

  it('removes a resume only after the confirmed delete succeeds', async () => {
    const title: HTMLInputElement = fixture.nativeElement.querySelector('#resume-title');
    title.value = 'Engineering';
    title.dispatchEvent(new Event('input'));
    select(new File(['pdf'], 'resume.pdf', { type: 'application/pdf' }));
    api.uploadResume.and.returnValue(of(resume));
    submit();
    const deletion = new Subject<{ deleted: true }>();
    api.deleteResume.and.returnValue(deletion);
    fixture.nativeElement.querySelector('[aria-label="Delete Engineering"]').click();
    const dialog =
      await TestbedHarnessEnvironment.documentRootLoader(fixture).getHarness(MatDialogHarness);
    expect(await dialog.getContentText()).toContain('Engineering');
    expect(api.deleteResume).not.toHaveBeenCalled();
    await (await dialog.getHarness(MatButtonHarness.with({ text: 'Delete resume' }))).click();
    expect(api.deleteResume).toHaveBeenCalledWith('r1');
    expect(fixture.nativeElement.textContent).toContain('resume.pdf');
    deletion.next({ deleted: true });
    deletion.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No resumes uploaded yet.');
  });
});
