import {
  JobApplicationPriority,
  JobApplicationStatus,
} from '../../db/models/job-application.model.js';

export type ApplicationCompanyDto = {
  id: string;
  name: string;
};

export type ApplicationContactDto = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
};

export type JobApplicationDto = {
  id: string;
  userId: string;
  companyId: string;
  contactId: string | null;
  jobTitle: string;
  jobUrl: string | null;
  source: string | null;
  status: JobApplicationStatus;
  priority: JobApplicationPriority;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  location: string | null;
  employmentType: string | null;
  workMode: string | null;
  appliedAt: string | null;
  notes: string | null;
  company: ApplicationCompanyDto;
  contact: ApplicationContactDto | null;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationStatusHistoryDto = {
  id: string;
  applicationId: string;
  fromStatus: JobApplicationStatus | null;
  toStatus: JobApplicationStatus;
  changedAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApplicationListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
