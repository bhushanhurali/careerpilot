/// <reference types="jasmine" />

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatPaginatorHarness } from '@angular/material/paginator/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { API_BASE_URL } from '../../../../core/config/api.config';
import { TaskListItem } from '../../data-access/task.models';
import { TasksPageComponent } from './tasks-page.component';

describe('TasksPageComponent', () => {
  const url = `${API_BASE_URL}/tasks`;
  const task: TaskListItem = {
    id: 'task-1',
    applicationId: 'application-1',
    application: { id: 'application-1', jobTitle: 'Backend Developer' },
    title: 'Send follow-up',
    dueOn: '2026-02-03',
    priority: 'high',
    notes: null,
    completedAt: null,
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  };
  let fixture: ComponentFixture<TasksPageComponent>;
  let http: HttpTestingController;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TasksPageComponent, NoopAnimationsModule],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TasksPageComponent);
    http = TestBed.inject(HttpTestingController);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function expectList(tasks: TaskListItem[], total = tasks.length, params = { page: '1' }): void {
    const list = http.expectOne((request) => request.method === 'GET' && request.url === url);
    for (const [key, value] of Object.entries(params)) {
      expect(list.request.params.get(key)).toBe(value);
    }
    list.flush({ success: true, data: { tasks }, meta: { total } });
    fixture.detectChanges();
  }

  it('links to the parent and completes and reopens through the nested endpoint', () => {
    expectList([task]);
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/applications/application-1');
    expect(host.querySelector('time')?.textContent).toBe('2026-02-03');
    expect(host.querySelector('button[aria-label^="Edit "]')).toBeNull();
    expect(host.querySelector('button[aria-label^="Delete "]')).toBeNull();

    const itemUrl = `${API_BASE_URL}/applications/application-1/tasks/task-1`;
    host.querySelector<HTMLButtonElement>('button[aria-label="Complete Send follow-up"]')?.click();
    const complete = http.expectOne({ method: 'PATCH', url: itemUrl });
    expect(complete.request.body).toEqual({ completed: true });
    const completed = { ...task, completedAt: '2026-02-04T00:00:00Z' };
    complete.flush({ success: true, data: { task: completed } });
    fixture.detectChanges();
    expectList([completed]);
    expect(host.textContent).toContain('Task completed.');

    host.querySelector<HTMLButtonElement>('button[aria-label="Reopen Send follow-up"]')?.click();
    const reopen = http.expectOne({ method: 'PATCH', url: itemUrl });
    expect(reopen.request.body).toEqual({ completed: false });
    reopen.flush({ success: true, data: { task } });
    fixture.detectChanges();
    expectList([task]);
    expect(host.textContent).toContain('Task reopened.');
  });

  it('requests the next page and resets it when a due filter changes', async () => {
    expectList([task], 21);
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const paginator = await loader.getHarness(MatPaginatorHarness);
    await paginator.goToNextPage();
    expectList([task], 21, { page: '2' });

    const view = await loader.getHarness(
      MatSelectHarness.with({ selector: '[formControlName="view"]' }),
    );
    await view.clickOptions({ text: 'Overdue' });
    const request = http.expectOne((candidate) => candidate.url === url);
    expect(request.request.params.get('due')).toBe('overdue');
    expect(request.request.params.get('page')).toBe('1');
    const today = new Date();
    expect(request.request.params.get('today')).toBe(
      [today.getFullYear(), today.getMonth() + 1, today.getDate()]
        .map((part) => String(part).padStart(2, '0'))
        .join('-'),
    );
    request.flush({ success: true, data: { tasks: [] }, meta: { total: 0 } });
    fixture.detectChanges();
    expect(host.textContent).toContain('No tasks match these filters.');
  });

  it('shows a load error and can retry', () => {
    expect(host.textContent).toContain('Loading tasks');
    http
      .expectOne((request) => request.url === url)
      .flush(
        { error: { message: 'Could not load tasks.' } },
        { status: 500, statusText: 'Server error' },
      );
    fixture.detectChanges();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Could not load tasks.');
    host.querySelector<HTMLButtonElement>('cp-task-list button')?.click();
    fixture.detectChanges();
    expectList([task]);
  });

  it('passes priority and sorting selections to the server', async () => {
    expectList([task]);
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const selections = [
      ['priority', 'High', { priority: 'high' }],
      ['sortBy', 'Priority', { priority: 'high', sortBy: 'priority' }],
      [
        'sortDirection',
        'Descending',
        { priority: 'high', sortBy: 'priority', sortDirection: 'desc' },
      ],
    ] as const;

    for (const [control, text, params] of selections) {
      const select = await loader.getHarness(
        MatSelectHarness.with({ selector: `[formControlName="${control}"]` }),
      );
      await select.clickOptions({ text });
      expectList([task], 1, { page: '1', ...params });
    }
  });
});
