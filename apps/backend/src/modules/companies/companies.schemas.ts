import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length > 0 ? value : null))
    .nullable()
    .optional();

const optionalUrl = z
  .string()
  .trim()
  .url()
  .max(2048)
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

const companyFieldsSchema = {
  name: z.string().trim().min(1).max(160),
  website: optionalUrl,
  industry: optionalText(120),
  location: optionalText(160),
  notes: optionalText(10_000),
};

export const companyIdParamsSchema = z
  .object({
    companyId: z.string().uuid(),
  })
  .strict();

export const createCompanySchema = z.object(companyFieldsSchema).strict();

export const updateCompanySchema = z
  .object({
    name: companyFieldsSchema.name.optional(),
    website: companyFieldsSchema.website,
    industry: companyFieldsSchema.industry,
    location: companyFieldsSchema.location,
    notes: companyFieldsSchema.notes,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one company field must be provided',
  });

const paginationNumber = (defaultValue: number, maxValue: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined ? defaultValue : Number(value)))
    .pipe(z.number().int().min(1).max(maxValue));

export const listCompaniesQuerySchema = z
  .object({
    page: paginationNumber(1, 10_000),
    pageSize: paginationNumber(20, 100),
    search: z.string().trim().min(1).max(160).optional(),
    industry: z.string().trim().min(1).max(120).optional(),
    location: z.string().trim().min(1).max(160).optional(),
    sortBy: z
      .enum(['name', 'industry', 'location', 'createdAt', 'updatedAt'])
      .optional()
      .default('name'),
    sortDirection: z.enum(['asc', 'desc']).optional().default('asc'),
  })
  .strict();

export type CompanyIdParams = z.infer<typeof companyIdParamsSchema>;
export type CreateCompanyBody = z.infer<typeof createCompanySchema>;
export type UpdateCompanyBody = z.infer<typeof updateCompanySchema>;
export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>;
