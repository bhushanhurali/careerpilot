import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DOCUMENT, signal } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import { AuthStore } from '../../../core/auth/auth.store';
import { API_BASE_URL } from '../../../core/config/api.config';
import { NotificationStore } from '../data-access/notification.store';
import type { NotificationItem } from '../data-access/notification.models';
import { NotificationCenterComponent } from './notification-center.component';

describe('notification center and refresh', () => {
  const url = `${API_BASE_URL}/notifications`;
  const task: NotificationItem = {
    id: 'task-notification',
    type: 'task_overdue',
    applicationId: 'application-1',
    jobTitle: 'Developer',
    companyName: 'Example',
    taskId: 'task-1',
    taskTitle: 'Follow up',
    taskDueOn: '2026-11-13',
    interviewId: null,
    interviewScheduledAt: null,
    scheduledFor: '2026-11-14T00:00:00Z',
    deliveredAt: '2026-11-14T00:01:00Z',
    readAt: null,
  };
  const response = (
    notifications: NotificationItem[],
    unreadCount: number,
    total = notifications.length,
  ) => ({
    success: true,
    data: { notifications, unreadCount },
    error: null,
    meta: { total },
  });
  let http: HttpTestingController;
  let store: NotificationStore;
  const active = signal(true);

  beforeEach(() => {
    active.set(true);
    TestBed.configureTestingModule({
      imports: [NotificationCenterComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        NotificationStore,
        {
          provide: AuthStore,
          useValue: { isAuthenticated: active, user: () => ({ id: 'user-1' }) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(NotificationStore);
  });

  function list(page = '1', unread = 'false', pageSize = '20') {
    return http.expectOne(
      (req) =>
        req.method === 'GET' &&
        req.url === url &&
        req.params.get('page') === page &&
        req.params.get('unread') === unread &&
        req.params.get('pageSize') === pageSize,
    );
  }

  it('loads, paginates, renders a date-only task and link, and recovers from a failed refresh', fakeAsync(() => {
    const fixture = TestBed.createComponent(NotificationCenterComponent);
    fixture.detectChanges();
    tick();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Loading notifications');
    list().flush(response([task], 24, 24));
    fixture.detectChanges();
    expect(element.textContent).toContain('Overdue task');
    expect(element.textContent).toContain('Due 2026-11-13');
    expect(element.querySelector('li a')?.getAttribute('href')).toBe('/applications/application-1');

    store.setPage(2, 20);
    list('2').flush('unavailable', { status: 500, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Could not load');
    expect(element.querySelector('li')).toBeNull();
    const retry = Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Retry'),
    );
    retry?.click();
    list('2').flush(response([task], 24, 24));
    fixture.detectChanges();
    expect(element.textContent).toContain('Overdue task');

    active.set(false);
    tick();
    fixture.destroy();
    http.verify();
  }));

  it('sends the read mutation and refreshes the unread count and filtered list', fakeAsync(() => {
    store.openInbox();
    TestBed.tick();
    tick();
    list().flush(response([task], 1));
    store.setUnread(true);
    list('1', 'true').flush(response([task], 1));
    store.markAsRead(task.id);
    const mutation = http.expectOne({ method: 'PATCH', url: `${url}/${task.id}/read` });
    expect(mutation.request.body).toBeNull();
    mutation.flush({
      success: true,
      data: { notification: { id: task.id, readAt: task.deliveredAt } },
    });
    list('1', 'true').flush(response([], 0));
    expect(store.notifications()).toEqual([]);
    expect(store.unreadCount()).toBe(0);

    active.set(false);
    TestBed.tick();
    tick();
    expect(store.unreadCount()).toBeNull();
    http.verify();
  }));

  it('drops a stale item and recovers when an unread page disappears', fakeAsync(() => {
    store.openInbox();
    TestBed.tick();
    tick();
    list().flush(response([task], 21, 21));
    store.setUnread(true);
    list('1', 'true').flush(response([task], 21, 21));
    store.setPage(2, 20);
    list('2', 'true').flush(response([task], 21, 21));
    store.markAsRead(task.id);
    http
      .expectOne({ method: 'PATCH', url: `${url}/${task.id}/read` })
      .flush(null, { status: 404, statusText: 'Not Found' });
    expect(store.notifications()).toEqual([]);
    expect(store.actionError()).toContain('no longer available');
    list('2', 'true').flush(response([], 20, 20));
    tick();
    list('1', 'true').flush(response([], 20, 20));
    expect(store.query().page).toBe(1);
    expect(store.unreadCount()).toBe(20);
    active.set(false);
    TestBed.tick();
    tick();
    http.verify();
  }));

  it('polls only in the visible authenticated session and refreshes on return', fakeAsync(() => {
    const document = TestBed.inject(DOCUMENT);
    const hidden = spyOnProperty(document, 'hidden', 'get').and.returnValue(false);
    TestBed.tick();
    tick();
    list('1', 'true', '1').flush(response([], 3, 3));
    tick(59_999);
    http.expectNone((req) => req.url === url);
    hidden.and.returnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    tick(60_001);
    http.expectNone((req) => req.url === url);
    hidden.and.returnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    list('1', 'true', '1').flush(response([], 2, 2));
    expect(store.unreadCount()).toBe(2);
    active.set(false);
    TestBed.tick();
    tick(60_000);
    http.verify();
  }));
});
