/// <reference types="jasmine" />

import { formatDate } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { API_BASE_URL } from '../../../../core/config/api.config';
import { Dashboard } from '../../data-access/dashboard.models';
import { DashboardStore } from '../../data-access/dashboard.store';
import { DashboardPageComponent } from './dashboard-page.component';

const emptyDashboard: Dashboard = {
  today: '2026-01-01',
  asOf: '2025-12-31T23:30:00.000Z',
  kpis: {
    activeApplications: 0,
    applicationsSubmittedThisMonth: 0,
    upcomingInterviews: 0,
    offersReceived: 0,
    overdueTasks: 0,
  },
  statusDistribution: [{ status: 'draft', count: 0 }],
  submissionTrend: [
    { month: '2025-08', count: 0 },
    { month: '2025-09', count: 0 },
    { month: '2025-10', count: 0 },
    { month: '2025-11', count: 0 },
    { month: '2025-12', count: 0 },
    { month: '2026-01', count: 0 },
  ],
  upcomingInterviews: [],
  overdueTasks: [],
  upcomingTasks: [],
  recentApplications: [],
};

describe('DashboardPageComponent', () => {
  const url = `${API_BASE_URL}/dashboard`;
  let fixture: ComponentFixture<DashboardPageComponent>;
  let http: HttpTestingController;
  let host: HTMLElement;
  let store: DashboardStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardPageComponent);
    host = fixture.nativeElement as HTMLElement;
    store = fixture.debugElement.injector.get(DashboardStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function expectRequest() {
    return http.expectOne((request) => request.url === url && request.method === 'GET');
  }

  function renderDashboard(dashboard: Dashboard): void {
    expectRequest().flush({ success: true, data: dashboard, error: null, meta: {} });
    fixture.detectChanges();
  }

  it('requests the local calendar date, guards against duplicate loads, and renders empty sections', () => {
    const now = new Date();
    fixture.detectChanges();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Loading dashboard');
    store.load();
    const request = expectRequest();
    expect(request.request.params.get('today')).toBe(
      [now.getFullYear(), now.getMonth() + 1, now.getDate()]
        .map((part) => String(part).padStart(2, '0'))
        .join('-'),
    );
    request.flush({ success: true, data: emptyDashboard });
    fixture.detectChanges();

    expect(store.loading()).toBeFalse();
    expect(
      Array.from(host.querySelectorAll('.metrics strong'), (node) => node.textContent?.trim()),
    ).toEqual(['0', '0', '0', '0', '0']);
    expect(host.textContent).toContain('No applications yet.');
    expect(host.textContent).toContain('No submissions in the last six months.');
    expect(host.textContent).toContain('No scheduled interviews coming up.');
    expect(host.textContent).toContain('No overdue tasks.');
    expect(host.textContent).toContain('No tasks due in the next seven days.');
    expect(host.textContent).toContain('No recent applications.');
    expect(host.querySelector('a[href="/applications/new"]')).not.toBeNull();
  });

  it('renders API totals and charts, links all previews, and keeps date-only labels stable', () => {
    const application = {
      applicationId: 'application-1',
      jobTitle: 'Backend Developer',
      companyName: 'Example Company',
    };
    const scheduledAt = '2026-01-01T00:30:00.000Z';
    const overdue = {
      ...application,
      id: 'task-1',
      title: 'Send reply',
      dueOn: '2025-12-31',
      priority: 'high',
    } as const;
    fixture.detectChanges();
    renderDashboard({
      ...emptyDashboard,
      kpis: {
        activeApplications: 12,
        applicationsSubmittedThisMonth: 4,
        upcomingInterviews: 8,
        offersReceived: 2,
        overdueTasks: 7,
      },
      statusDistribution: [
        { status: 'accepted', count: 2 },
        { status: 'applied', count: 12 },
      ],
      submissionTrend: emptyDashboard.submissionTrend.map((item) =>
        item.month === '2026-01' ? { ...item, count: 4 } : item,
      ),
      upcomingInterviews: [{ ...application, id: 'interview-1', type: 'technical', scheduledAt }],
      overdueTasks: [overdue],
      upcomingTasks: [{ ...overdue, id: 'task-2', title: 'Follow up', dueOn: '2026-01-01' }],
      recentApplications: [
        {
          ...application,
          id: application.applicationId,
          status: 'applied',
          updatedAt: scheduledAt,
        },
      ],
    });

    expect(
      Array.from(host.querySelectorAll('.metrics strong'), (node) => node.textContent?.trim()),
    ).toEqual(['12', '4', '8', '2', '7']);
    expect(host.querySelector('.status-chart')?.textContent).toContain('Accepted');
    expect(host.querySelector<HTMLElement>('.status-chart li:last-child .bar')?.style.width).toBe(
      '100%',
    );
    expect(host.querySelectorAll('.trend-chart li').length).toBe(6);
    expect(host.querySelector('.trend-chart time[datetime="2026-01"]')?.textContent?.trim()).toBe(
      'Jan 26',
    );
    expect(host.querySelector<HTMLElement>('.trend-chart li:last-child .bar')?.style.height).toBe(
      '100%',
    );
    expect(host.querySelector('header time')?.textContent?.trim()).toBe('January 1, 2026');
    expect(host.querySelector('time[datetime="2025-12-31"]')?.textContent?.trim()).toBe(
      'Dec 31, 2025',
    );
    expect(
      host
        .querySelector('[aria-labelledby="tasks-heading"] time[datetime="2026-01-01"]')
        ?.textContent?.trim(),
    ).toBe('Jan 1, 2026');
    expect(
      host
        .querySelector(`[aria-labelledby="interview-heading"] time[datetime="${scheduledAt}"]`)
        ?.textContent?.trim(),
    ).toBe(formatDate(scheduledAt, 'medium', 'en-US'));
    expect(host.querySelectorAll('a[href="/applications/application-1"]').length).toBe(4);
    expect(
      host.querySelector('#tasks-heading')?.parentElement?.parentElement?.textContent,
    ).toContain('Today and next 6 days');
  });

  it('displays API errors and replaces them with the retried result', () => {
    fixture.detectChanges();
    expectRequest().flush(
      { success: false, error: { message: 'Dashboard is unavailable.' } },
      { status: 503, statusText: 'Unavailable' },
    );
    fixture.detectChanges();
    expect(store.loading()).toBeFalse();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Dashboard is unavailable.',
    );

    const heading = host.querySelector('h1');
    if (!heading) throw new Error('Expected the dashboard heading');
    const focus = spyOn(heading, 'focus');
    host.querySelector('button')?.click();
    expect(focus).toHaveBeenCalled();
    fixture.detectChanges();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Loading dashboard');
    renderDashboard(emptyDashboard);
    expect(store.dashboard()).toEqual(emptyDashboard);
    expect(host.querySelector('.metrics')).not.toBeNull();
  });

  it('cancels an in-flight load when the page is destroyed', () => {
    fixture.detectChanges();
    const request = expectRequest();
    fixture.destroy();
    expect(request.cancelled).toBeTrue();
  });
});
