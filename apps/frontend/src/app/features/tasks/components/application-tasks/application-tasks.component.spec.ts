/// <reference types="jasmine" />

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';

import { API_BASE_URL } from '../../../../core/config/api.config';
import { Task, TaskFormValue } from '../../data-access/task.models';
import { TaskDialogData } from '../task-dialog/task-dialog.component';
import { ApplicationTasksComponent } from './application-tasks.component';

describe('ApplicationTasksComponent', () => {
  const url = `${API_BASE_URL}/applications/application-1/tasks`;
  const value: TaskFormValue = {
    title: 'Send follow-up',
    notes: null,
    dueOn: null,
    priority: 'medium',
  };
  const task: Task = {
    ...value,
    id: 'task-1',
    applicationId: 'application-1',
    completedAt: null,
    createdAt: '2026-11-11T00:00:00Z',
    updatedAt: '2026-11-11T00:00:00Z',
  };
  let fixture: ComponentFixture<ApplicationTasksComponent>;
  let http: HttpTestingController;
  let open: jasmine.Spy<MatDialog['open']>;
  let closed: Subject<boolean>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplicationTasksComponent, NoopAnimationsModule],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ApplicationTasksComponent);
    host = fixture.nativeElement as HTMLElement;
    http = TestBed.inject(HttpTestingController);
    closed = new Subject();
    open = spyOn(fixture.debugElement.injector.get(MatDialog), 'open').and.returnValue(
      jasmine.createSpyObj('MatDialogRef', { afterClosed: closed.asObservable() }),
    );
    fixture.componentRef.setInput('applicationId', 'application-1');
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function expectList(tasks: Task[]): void {
    http.expectOne({ method: 'GET', url }).flush({ success: true, data: { tasks } });
    fixture.detectChanges();
  }

  function openDialog(selector: string): TaskDialogData {
    host.querySelector<HTMLButtonElement>(selector)?.click();
    return open.calls.mostRecent().args[1]?.data as TaskDialogData;
  }

  it('creates a task in the selected application and refreshes on success', () => {
    expectList([]);
    expect(host.textContent).toContain('No tasks yet.');
    const data = openDialog('.section-header button');
    if (data.mode !== 'save') throw new Error('Expected save dialog');
    expect(data.task).toBeUndefined();
    data.save(value).subscribe(() => closed.next(true));
    const create = http.expectOne({ method: 'POST', url });
    expect(create.request.body).toEqual(value);
    create.flush({ success: true, data: { task } });
    fixture.detectChanges();
    expectList([task]);
    expect(host.textContent).toContain('Task created.');
  });

  it('edits and deletes only through the nested task URL', () => {
    expectList([task]);
    const data = openDialog('button[aria-label="Edit Send follow-up"]');
    if (data.mode !== 'save') throw new Error('Expected edit dialog');
    expect(data.task).toEqual(task);
    const updated = { ...task, title: 'Send email', dueOn: '2026-12-15' };
    const payload = { ...value, title: updated.title, dueOn: updated.dueOn };
    data.save(payload).subscribe(() => {
      closed.next(true);
      closed.complete();
    });
    const itemUrl = `${url}/${task.id}`;
    const patch = http.expectOne({ method: 'PATCH', url: itemUrl });
    expect(patch.request.body).toEqual(payload);
    patch.flush({ success: true, data: { task: updated } });
    fixture.detectChanges();
    expectList([updated]);

    closed = new Subject();
    open.and.returnValue(
      jasmine.createSpyObj('MatDialogRef', { afterClosed: closed.asObservable() }),
    );
    const confirmation = openDialog('button[aria-label="Delete Send email"]');
    if (confirmation.mode !== 'delete') throw new Error('Expected delete dialog');
    http.expectNone({ method: 'DELETE', url: itemUrl });
    confirmation.delete().subscribe(() => closed.next(true));
    http
      .expectOne({ method: 'DELETE', url: itemUrl })
      .flush({ success: true, data: { deleted: true } });
    fixture.detectChanges();
    expectList([]);
    expect(host.textContent).toContain('Task deleted.');
  });
});
