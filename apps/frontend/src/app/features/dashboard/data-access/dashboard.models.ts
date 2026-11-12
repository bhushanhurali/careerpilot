import type { ApplicationStatus } from '../../applications/data-access/application.models';
import type { Interview } from '../../interviews/data-access/interview.models';
import type { TaskPriority } from '../../tasks/data-access/task.models';

type ApplicationSummary = {
  applicationId: string;
  jobTitle: string;
  companyName: string;
};

export type DashboardTask = ApplicationSummary & {
  id: string;
  title: string;
  dueOn: string;
  priority: TaskPriority;
};

export type Dashboard = {
  asOf: string;
  today: string;
  kpis: {
    activeApplications: number;
    applicationsSubmittedThisMonth: number;
    upcomingInterviews: number;
    offersReceived: number;
    overdueTasks: number;
  };
  statusDistribution: { status: ApplicationStatus; count: number }[];
  submissionTrend: { month: string; count: number }[];
  upcomingInterviews: (ApplicationSummary & {
    id: string;
    type: Interview['type'];
    scheduledAt: string;
  })[];
  overdueTasks: DashboardTask[];
  upcomingTasks: DashboardTask[];
  recentApplications: {
    id: string;
    jobTitle: string;
    companyName: string;
    status: ApplicationStatus;
    updatedAt: string;
  }[];
};
