import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';

import {
  ApplicationStatus,
  applicationStatusOptions,
} from '../../../applications/data-access/application.models';
import { Interview, interviewTypeOptions } from '../../../interviews/data-access/interview.models';
import { Dashboard } from '../../data-access/dashboard.models';
import { DashboardStore } from '../../data-access/dashboard.store';

@Component({
  selector: 'cp-dashboard-page',
  imports: [
    DatePipe,
    DecimalPipe,
    TitleCasePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  providers: [DashboardStore],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
  protected readonly store = inject(DashboardStore);
  protected readonly metrics = [
    { key: 'activeApplications', label: 'Active applications', icon: 'work_outline' },
    { key: 'applicationsSubmittedThisMonth', label: 'Submitted this month', icon: 'event_note' },
    { key: 'upcomingInterviews', label: 'Upcoming interviews', icon: 'event_available' },
    { key: 'offersReceived', label: 'Offers received', icon: 'handshake' },
    { key: 'overdueTasks', label: 'Overdue tasks', icon: 'assignment_late' },
  ] as const satisfies readonly { key: keyof Dashboard['kpis']; label: string; icon: string }[];

  protected readonly statusMax = computed(() =>
    Math.max(0, ...(this.store.dashboard()?.statusDistribution.map(({ count }) => count) ?? [])),
  );
  protected readonly trendMax = computed(() =>
    Math.max(0, ...(this.store.dashboard()?.submissionTrend.map(({ count }) => count) ?? [])),
  );

  ngOnInit(): void {
    this.store.load();
  }

  protected statusLabel(status: ApplicationStatus): string {
    return applicationStatusOptions.find((option) => option.value === status)?.label ?? status;
  }

  protected interviewLabel(type: Interview['type']): string {
    return interviewTypeOptions.find((option) => option.value === type)?.label ?? type;
  }
}
