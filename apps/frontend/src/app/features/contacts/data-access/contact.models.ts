export type Contact = {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  roleTitle: string | null;
  linkedInUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactFormValue = {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  roleTitle: string | null;
  linkedInUrl: string | null;
  notes: string | null;
};

export type ContactListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  sortBy: 'firstName' | 'lastName' | 'createdAt' | 'updatedAt';
  sortDirection: 'asc' | 'desc';
};

export type ContactPaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ContactApiErrorResponse = {
  code: string;
  message: string;
  details?: unknown;
};

export type ContactApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: ContactApiErrorResponse | null;
  meta: Record<string, unknown>;
};
