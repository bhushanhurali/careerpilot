export type Company = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyFormValue = {
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  notes: string | null;
};

export type CompanyListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  industry?: string;
  location?: string;
  sortBy: 'name' | 'industry' | 'location' | 'createdAt' | 'updatedAt';
  sortDirection: 'asc' | 'desc';
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApiErrorResponse = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  error: ApiErrorResponse | null;
  meta: Record<string, unknown>;
};
