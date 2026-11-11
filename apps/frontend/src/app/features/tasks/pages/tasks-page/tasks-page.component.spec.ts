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

  function expectList(
    tasks: TaskListItem[],
    total = tasks.length,
    params: Record<string, string> = { page: '1' },
  ): void {
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
    const results = host.querySelector<HTMLElement>('cp-task-list [role="group"]');
    if (!results) throw new Error('Missing task results');
    const focus = spyOn(results, 'focus');
    host.querySelector<HTMLButtonElement>('cp-task-list button')?.click();
    expect(focus).toHaveBeenCalled();
    fixture.detectChanges();
    expectList([task]);
  });

  it('keeps the task open on a failed completion and only refreshes after success', () => {
    expectList([task]);
    const button = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Complete Send follow-up"]',
    );
    if (!button) throw new Error('Missing completion button');
    const itemUrl = `${API_BASE_URL}/applications/application-1/tasks/task-1`;
    button.click();
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();
    expect(host.querySelector('button[aria-label="Reopen Send follow-up"]')).toBeNull();
    button.click();
    http
      .expectOne({ method: 'PATCH', url: itemUrl })
      .flush(
        { error: { message: 'Could not complete the task.' } },
        { status: 500, statusText: 'Server error' },
      );
    fixture.detectChanges();
    http.expectNone((request) => request.url === url);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not complete the task.',
    );
    expect(button.disabled).toBeFalse();
    expect(host.querySelector('button[aria-label="Reopen Send follow-up"]')).toBeNull();

    button.click();
    const completed = { ...task, completedAt: '2026-02-04T00:00:00Z' };
    http
      .expectOne({ method: 'PATCH', url: itemUrl })
      .flush({ success: true, data: { task: completed } });
    fixture.detectChanges();
    expectList([completed]);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector('button[aria-label="Reopen Send follow-up"]')).not.toBeNull();
  });

  it('returns to the last valid page when completing the only task on a filtered page', async () => {
    expectList([task], 21);
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const view = await loader.getHarness(
      MatSelectHarness.with({ selector: '[formControlName="view"]' }),
    );
    await view.clickOptions({ text: 'Open' });
    expectList([task], 21, { page: '1', status: 'open' });
    await (await loader.getHarness(MatPaginatorHarness)).goToNextPage();
    expectList([task], 21, { page: '2', status: 'open' });

    host.querySelector<HTMLButtonElement>('button[aria-label="Complete Send follow-up"]')?.click();
    http
      .expectOne({
        method: 'PATCH',
        url: `${API_BASE_URL}/applications/application-1/tasks/task-1`,
      })
      .flush({ success: true, data: { task: { ...task, completedAt: '2026-02-04T00:00:00Z' } } });
    fixture.detectChanges();
    expectList([], 20, { page: '2', status: 'open' });
    expectList([{ ...task, id: 'task-2', title: 'Another follow-up' }], 20, {
      page: '1',
      status: 'open',
    });
    expect(host.textContent).toContain('Another follow-up');
    expect(host.textContent).not.toContain('Send follow-up');
  });

  it('cancels a stale page request when filters change', async () => {
    const initial = http.expectOne((request) => request.url === url);
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const view = await loader.getHarness(
      MatSelectHarness.with({ selector: '[formControlName="view"]' }),
    );
    await view.clickOptions({ text: 'Completed' });
    expect(initial.cancelled).toBeTrue();
    expectList([], 0, { page: '1', status: 'completed' });
    expect(host.textContent).toContain('No tasks match these filters.');
  });

  it('labels only open dated tasks relative to the local calendar day', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date(2026, 0, 1, 0, 1));
      expectList([
        { ...task, id: 'past', dueOn: '2025-12-31' },
        { ...task, id: 'today', dueOn: '2026-01-01' },
        { ...task, id: 'future', dueOn: '2026-01-02' },
        { ...task, id: 'undated', dueOn: null },
        { ...task, id: 'done', dueOn: '2025-12-31', completedAt: '2025-12-31T20:00:00Z' },
      ]);
      const rows = Array.from(host.querySelectorAll('.task-list li'));
      expect(rows.map((row) => row.querySelector('strong')?.textContent?.trim())).toEqual([
        'Overdue',
        'Due today',
        undefined,
        undefined,
        undefined,
      ]);
      expect(rows[0]?.querySelector('time')?.dateTime).toBe('2025-12-31');
    } finally {
      jasmine.clock().uninstall();
    }
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
