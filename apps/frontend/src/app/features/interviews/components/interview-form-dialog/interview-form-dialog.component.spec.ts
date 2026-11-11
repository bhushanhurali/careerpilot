/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';

import { Interview } from '../../data-access/interview.models';
import {
  InterviewFormDialogComponent,
  InterviewFormDialogData,
} from './interview-form-dialog.component';

describe('InterviewFormDialogComponent', () => {
  const interview: Interview = {
    id: 'interview-1',
    applicationId: 'application-1',
    type: 'technical',
    status: 'scheduled',
    scheduledAt: '2026-12-03T11:00:24.000Z',
    durationMinutes: 45,
    location: 'Berlin',
    meetingUrl: null,
    notes: null,
    createdAt: '2026-11-11T10:00:00.000Z',
    updatedAt: '2026-11-11T10:00:00.000Z',
  };
  let fixture: ComponentFixture<InterviewFormDialogComponent>;
  let host: HTMLElement;
  let dialogRef: jasmine.SpyObj<MatDialogRef<InterviewFormDialogComponent, boolean>>;
  let saveAction: jasmine.Spy<InterviewFormDialogData['saveAction']>;

  async function setup(existing?: Interview): Promise<void> {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    saveAction = jasmine.createSpy('saveAction').and.returnValue(of(interview));
    await TestBed.configureTestingModule({
      imports: [InterviewFormDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { interview: existing, saveAction } },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(InterviewFormDialogComponent);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function change(field: string, value: string): void {
    const control = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `[formControlName="${field}"]`,
    );
    if (!control) {
      throw new Error(`Form control not found: ${field}`);
    }
    control.value = value;
    control.dispatchEvent(new Event('input'));
  }

  function submit(): void {
    host.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('requires a schedule and submits local date and time as UTC', async () => {
    await setup();
    submit();
    expect(saveAction).not.toHaveBeenCalled();

    change('scheduledAt', '2026-12-03T11:00');
    change('durationMinutes', '1.5');
    submit();
    expect(saveAction).not.toHaveBeenCalled();

    change('durationMinutes', '45');
    change('notes', '  Bring portfolio  ');
    submit();
    expect(saveAction).toHaveBeenCalledOnceWith({
      type: 'recruiter_screen',
      status: 'scheduled',
      scheduledAt: new Date(2026, 11, 3, 11).toISOString(),
      durationMinutes: 45,
      location: null,
      meetingUrl: null,
      notes: 'Bring portfolio',
    });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('retains an unchanged schedule exactly and allows retry after a failed edit', async () => {
    await setup(interview);
    saveAction.and.returnValue(throwError(() => new Error('Interview was not found.')));
    change('location', '');
    submit();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Interview was not found.');

    saveAction.and.returnValue(of(interview));
    submit();
    expect(saveAction.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ scheduledAt: interview.scheduledAt, location: null }),
    );
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('validates meeting links and sends the rescheduled time once while saving', async () => {
    await setup(interview);
    const pending = new Subject<Interview>();
    saveAction.and.returnValue(pending);
    change('scheduledAt', '2026-12-06T14:25');
    change('meetingUrl', 'ftp://example.com/meeting');
    submit();
    expect(saveAction).not.toHaveBeenCalled();
    expect(host.querySelector('mat-error')?.textContent).toContain('HTTP or HTTPS');

    change('meetingUrl', ' https://example.com/meeting ');
    submit();
    submit();
    expect(saveAction).toHaveBeenCalledTimes(1);
    expect(saveAction.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({
        scheduledAt: new Date(2026, 11, 6, 14, 25).toISOString(),
        meetingUrl: 'https://example.com/meeting',
      }),
    );
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBeTrue();
    expect(dialogRef.disableClose).toBeTrue();
    expect(dialogRef.close).not.toHaveBeenCalled();
    pending.next(interview);
    pending.complete();
    expect(dialogRef.close).toHaveBeenCalledOnceWith(true);
  });
});
