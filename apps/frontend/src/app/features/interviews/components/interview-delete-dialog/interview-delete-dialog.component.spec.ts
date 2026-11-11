/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject } from 'rxjs';

import {
  InterviewDeleteDialogComponent,
  InterviewDeleteDialogData,
} from './interview-delete-dialog.component';

describe('InterviewDeleteDialogComponent', () => {
  let fixture: ComponentFixture<InterviewDeleteDialogComponent>;
  let host: HTMLElement;
  let dialogRef: jasmine.SpyObj<MatDialogRef<InterviewDeleteDialogComponent, boolean>>;
  let deleteAction: jasmine.Spy<InterviewDeleteDialogData['deleteAction']>;

  function button(text: string): HTMLButtonElement {
    const match = Array.from(host.querySelectorAll('button')).find((element) =>
      element.textContent?.includes(text),
    );
    if (!match) {
      throw new Error(`Button not found: ${text}`);
    }

    return match;
  }

  beforeEach(async () => {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    deleteAction = jasmine.createSpy('deleteAction');
    await TestBed.configureTestingModule({
      imports: [InterviewDeleteDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { typeLabel: 'Technical', scheduledAt: '2026-12-03T11:00:00Z', deleteAction },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(InterviewDeleteDialogComponent);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  it('cancels without deleting', () => {
    button('Cancel').click();
    expect(dialogRef.close).toHaveBeenCalledTimes(1);
    expect(deleteAction).not.toHaveBeenCalled();
  });

  it('blocks duplicate deletion and allows retry after a failed request', () => {
    const pending = new Subject<void>();
    deleteAction.and.returnValue(pending);

    const confirm = button('Delete interview');
    confirm.click();
    fixture.detectChanges();
    expect(confirm.disabled).toBeTrue();
    expect(button('Cancel').disabled).toBeTrue();
    expect(dialogRef.disableClose).toBeTrue();
    confirm.click();
    expect(deleteAction).toHaveBeenCalledTimes(1);

    pending.error(new Error('Could not delete this interview.'));
    fixture.detectChanges();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not delete this interview.',
    );
    expect(confirm.disabled).toBeFalse();
    expect(button('Cancel').disabled).toBeFalse();
    expect(dialogRef.disableClose).toBeFalse();
    expect(dialogRef.close).not.toHaveBeenCalled();

    deleteAction.and.returnValue(of(undefined));
    confirm.click();
    fixture.detectChanges();
    expect(deleteAction).toHaveBeenCalledTimes(2);
    expect(dialogRef.close).toHaveBeenCalledOnceWith(true);
  });
});
