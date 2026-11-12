import type { InterviewType } from '../../db/models/interview.model.js';
import type { JobApplicationStatus } from '../../db/models/job-application.model.js';
import type { TaskPriority } from '../../db/models/task.model.js';

type ApplicationSummary = {
  applicationId: string;
  jobTitle: string;
  companyName: string;
};

type DashboardTask = ApplicationSummary & {
  id: string;
  title: string;
  dueOn: string;
  priority: TaskPriority;
};

export type DashboardDto = {
  asOf: string;
  today: string;
  kpis: {
    activeApplications: number;
    applicationsSubmittedThisMonth: number;
    upcomingInterviews: number;
    offersReceived: number;
    overdueTasks: number;
  };
  statusDistribution: { status: JobApplicationStatus; count: number }[];
  submissionTrend: { month: string; count: number }[];
  upcomingInterviews: (ApplicationSummary & {
    id: string;
    type: InterviewType;
    scheduledAt: string;
  })[];
  overdueTasks: DashboardTask[];
  upcomingTasks: DashboardTask[];
  recentApplications: {
    id: string;
    jobTitle: string;
    companyName: string;
    status: JobApplicationStatus;
    updatedAt: string;
  }[];
};
