export const interviewTypeOptions = [
  { value: 'phone_screen', label: 'Phone screen' },
  { value: 'recruiter_screen', label: 'Recruiter screen' },
  { value: 'technical', label: 'Technical' },
  { value: 'coding', label: 'Coding' },
  { value: 'system_design', label: 'System design' },
  { value: 'hiring_manager', label: 'Hiring manager' },
  { value: 'onsite', label: 'Onsite' },
  { value: 'hr', label: 'HR' },
  { value: 'final', label: 'Final' },
  { value: 'other', label: 'Other' },
] as const;

export const interviewStatusOptions = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'no_show', label: 'No-show' },
] as const;

export type InterviewFormValue = {
  type: (typeof interviewTypeOptions)[number]['value'];
  status: (typeof interviewStatusOptions)[number]['value'];
  scheduledAt: string;
  durationMinutes: number | null;
  location: string | null;
  meetingUrl: string | null;
  notes: string | null;
};

export type Interview = InterviewFormValue & {
  id: string;
  applicationId: string;
  createdAt: string;
  updatedAt: string;
};
