export type CompanyDto = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CompanySortBy = 'name' | 'industry' | 'location' | 'createdAt' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';
