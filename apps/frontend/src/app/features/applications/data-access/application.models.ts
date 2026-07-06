export type ApplicationStatus =
  | 'draft'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn'
  | 'accepted';

export type ApplicationPriority = 'low' | 'medium' | 'high';

export type ApplicationCompany = {
  id: string;
  name: string;
};

export type ApplicationContact = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
};

export type JobApplication = {
  id: string;
  userId: string;
  companyId: string;
  contactId: string | null;
  jobTitle: string;
  jobUrl: string | null;
  source: string | null;
  status: ApplicationStatus;
  priority: ApplicationPriority;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  location: string | null;
  employmentType: string | null;
  workMode: string | null;
  appliedAt: string | null;
  notes: string | null;
  company: ApplicationCompany;
  contact: ApplicationContact | null;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationFormValue = {
  companyId: string;
  contactId: string | null;
  jobTitle: string;
  jobUrl: string | null;
  source: string | null;
  status: ApplicationStatus;
  priority: ApplicationPriority;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  location: string | null;
  employmentType: string | null;
  workMode: string | null;
  appliedAt: string | null;
  notes: string | null;
};

export type ApplicationUpdateValue = Omit<ApplicationFormValue, 'status'>;

export type ApplicationStatusHistoryEntry = {
  id: string;
  applicationId: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  changedAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationStatusTransitionValue = {
  status: ApplicationStatus;
  note: string | null;
};

export type ApplicationListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: ApplicationStatus;
  priority?: ApplicationPriority;
  companyId?: string;
  contactId?: string;
  source?: string;
  location?: string;
  employmentType?: string;
  workMode?: string;
  sortBy:
    | 'jobTitle'
    | 'status'
    | 'priority'
    | 'companyName'
    | 'appliedAt'
    | 'createdAt'
    | 'updatedAt';
  sortDirection: 'asc' | 'desc';
};

export type ApplicationPaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApplicationApiErrorResponse = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApplicationApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: ApplicationApiErrorResponse | null;
  meta: Record<string, unknown>;
};

export const applicationStatusOptions: { value: ApplicationStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'accepted', label: 'Accepted' },
];

export const applicationPriorityOptions: { value: ApplicationPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
