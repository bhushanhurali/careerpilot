/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

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

  function componentApi() {
    return fixture.componentInstance as unknown as {
      form: {
        setValue: (value: { status: 'interviewing'; note: string }) => void;
      };
      submit: () => void;
    };
  }
});
