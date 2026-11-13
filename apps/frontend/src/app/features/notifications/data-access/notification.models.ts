export type NotificationItem = {
  id: string;
  type: 'interview_reminder' | 'task_due' | 'task_overdue';
  applicationId: string;
  jobTitle: string;
  companyName: string;
  interviewId: string | null;
  interviewScheduledAt: string | null;
  taskId: string | null;
  taskTitle: string | null;
  taskDueOn: string | null;
  scheduledFor: string;
  deliveredAt: string;
  readAt: string | null;
};

export type NotificationQuery = { page: number; pageSize: number; unread: boolean };
