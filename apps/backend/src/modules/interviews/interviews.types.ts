import type { InterviewStatus, InterviewType } from '../../db/models/interview.model.js';

export type InterviewDto = {
  id: string;
  applicationId: string;
  type: InterviewType;
  status: InterviewStatus;
  scheduledAt: string;
  durationMinutes: number | null;
  location: string | null;
  meetingUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
