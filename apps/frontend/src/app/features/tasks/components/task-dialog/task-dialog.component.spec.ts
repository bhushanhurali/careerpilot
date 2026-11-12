/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Observable, of, Subject, throwError } from 'rxjs';

import { Task, TaskFormValue } from '../../data-access/task.models';
import { TaskDialogComponent, TaskDialogData } from './task-dialog.component';

describe('TaskDialogComponent', () => {
  const task: Task = {
    id: 'task-1',
    applicationId: 'application-1',
    title: 'Follow up',
    notes: null,
    dueOn: '2028-02-29',
    priority: 'medium',
    completedAt: null,
    createdAt: '2026-11-11T00:00:00Z',
    updatedAt: '2026-11-11T00:00:00Z',
  };
  let fixture: ComponentFixture<TaskDialogComponent>;
  let host: HTMLElement;
  let save: jasmine.Spy<(value: TaskFormValue) => Observable<Task>>;
  let close: jasmine.Spy;

  async function setup(data?: TaskDialogData): Promise<void> {
    save = jasmine.createSpy('save').and.returnValue(of(task));
    close = jasmine.createSpy('close');
    await TestBed.configureTestingModule({
      imports: [TaskDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data ?? { mode: 'save', task, save } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TaskDialogComponent);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  function setTitle(value: string): void {
    const input = host.querySelector<HTMLInputElement>('input[formControlName="title"]');
    if (!input) throw new Error('Missing title input');
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(): void {
    host.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('rejects a blank title and submits the original date-only string', async () => {
    await setup();
    setTitle('  ');
    submit();
    expect(save).not.toHaveBeenCalled();
    setTitle('  Follow up again  ');
    submit();
    expect(save).toHaveBeenCalledOnceWith({
      title: 'Follow up again',
      notes: null,
      dueOn: '2028-02-29',
      priority: 'medium',
    });
    expect(close).toHaveBeenCalledOnceWith(true);
  });

  it('retains edits and allows retry after a failed save', async () => {
    await setup();
    save.and.returnValue(throwError(() => new Error('Task was not found')));
    setTitle('Try again');
    submit();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Task was not found');
    expect(close).not.toHaveBeenCalled();
    save.and.returnValue(of(task));
    submit();
    expect(save.calls.mostRecent().args[0].title).toBe('Try again');
    expect(close).toHaveBeenCalledOnceWith(true);
  });

  it('blocks an incomplete native date entry but allows intentionally clearing the date', async () => {
    await setup();
    const input = host.querySelector<HTMLInputElement>('input[type="date"]');
    if (!input) throw new Error('Missing date input');
    let badInput = true;
    Object.defineProperty(input, 'validity', { get: () => ({ badInput }) });
    input.value = '';
    input.dispatchEvent(new Event('input'));
    submit();
    expect(save).not.toHaveBeenCalled();
    expect(host.querySelector('mat-error')?.textContent).toContain('Enter a valid date.');

    badInput = false;
    input.dispatchEvent(new Event('input'));
    submit();
    expect(save).toHaveBeenCalledOnceWith(jasmine.objectContaining({ dueOn: null }));
  });

  it('guards against duplicate deletion and allows retry after an API error', async () => {
    const pending = new Subject<void>();
    const remove = jasmine.createSpy<() => Observable<void>>('remove').and.returnValue(pending);
    await setup({ mode: 'delete', task, delete: remove });
    submit();
    submit();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBeTrue();
    pending.error(new Error('Could not delete the task.'));
    fixture.detectChanges();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not delete the task.',
    );
    expect(close).not.toHaveBeenCalled();

    remove.and.returnValue(of(undefined));
    submit();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledOnceWith(true);
  });
});
