/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import {
  ApplicationStatusTransitionDialogComponent,
  ApplicationStatusTransitionDialogData,
} from './application-status-transition-dialog.component';

describe('ApplicationStatusTransitionDialogComponent', () => {
  let fixture: ComponentFixture<ApplicationStatusTransitionDialogComponent>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<ApplicationStatusTransitionDialogComponent, boolean>>;
  let transitionAction: jasmine.Spy;

  beforeEach(async () => {
    dialogRef = jasmine.createSpyObj<MatDialogRef<ApplicationStatusTransitionDialogComponent>>(
      'MatDialogRef',
      ['close'],
    );
    transitionAction = jasmine.createSpy('transitionAction').and.returnValue(of({}));
    const data: ApplicationStatusTransitionDialogData = {
      currentStatus: 'applied',
      transitionAction,
    };

    await TestBed.configureTestingModule({
      imports: [ApplicationStatusTransitionDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationStatusTransitionDialogComponent);
    fixture.detectChanges();
  });

  it('submits a normalized transition payload and closes on success', () => {
    componentApi().form.setValue({
      status: 'interviewing',
      note: '  Technical interview scheduled  ',
    });

    componentApi().submit();

    expect(transitionAction).toHaveBeenCalledWith({
      status: 'interviewing',
      note: 'Technical interview scheduled',
    });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('does not offer the current status as a transition target', () => {
    const optionLabels = Array.from(fixture.nativeElement.querySelectorAll('mat-option')).map(
      (option) => (option as HTMLElement).textContent?.trim(),
    );

    expect(componentApi().statusOptions.map((status) => status.value)).not.toContain('applied');
    expect(optionLabels).not.toContain('Applied');
  });

  it('validates note length before submitting', () => {
    componentApi().form.setValue({
      status: 'interviewing',
      note: 'x'.repeat(10_001),
    });

    componentApi().submit();

    expect(transitionAction).not.toHaveBeenCalled();
    expect(componentApi().fieldError()).toBe('Use a shorter note.');
  });

  it('shows transition errors without closing the dialog', () => {
    transitionAction.and.returnValue(throwError(() => new Error('Status unchanged.')));
    componentApi().form.setValue({
      status: 'interviewing',
      note: '',
    });

    componentApi().submit();
    fixture.detectChanges();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(componentApi().isSaving).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Status unchanged.');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });

  function componentApi() {
    return fixture.componentInstance as unknown as {
      statusOptions: { value: string; label: string }[];
      form: {
        setValue: (value: { status: 'interviewing'; note: string }) => void;
      };
      submit: () => void;
      fieldError: () => string | null;
      isSaving: boolean;
    };
  }
});
