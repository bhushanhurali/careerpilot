import type { NotificationType } from '../../db/models/notification.model.js';

export type NotificationDto = {
  id: string;
  type: NotificationType;
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
