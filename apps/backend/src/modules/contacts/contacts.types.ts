export type ContactDto = {
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

export type ContactListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
