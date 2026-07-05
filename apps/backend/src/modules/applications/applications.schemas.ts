import { z } from 'zod';

const applicationStatuses = [
  'draft',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'rejected',
  'withdrawn',
  'accepted',
] as const;

const applicationPriorities = ['low', 'medium', 'high'] as const;

const emptyStringToNull = (value: unknown): unknown =>
  typeof value === 'string' && value.trim().length === 0 ? null : value;

const optionalText = (max: number) =>
  z.preprocess(emptyStringToNull, z.string().trim().max(max).nullable()).optional();

const optionalUrl = z
  .preprocess(emptyStringToNull, z.string().trim().url().max(2048).nullable())
  .optional();

const optionalUuid = z.preprocess(emptyStringToNull, z.string().uuid().nullable()).optional();

const optionalDateOnly = z
  .preprocess(
    emptyStringToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  )
  .refine((value) => value === null || !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
    message: 'Date must be a valid ISO date',
  })
  .optional();

const optionalSalary = z
  .preprocess(emptyStringToNull, z.number().int().min(0).nullable())
  .optional();

const optionalCurrency = z
  .preprocess(emptyStringToNull, z.string().trim().length(3).toUpperCase().nullable())
  .optional();

const applicationFieldsSchema = {
  companyId: z.string().uuid(),
  contactId: optionalUuid,
  jobTitle: z.string().trim().min(1).max(160),
  jobUrl: optionalUrl,
  source: optionalText(120),
  status: z.enum(applicationStatuses).optional().default('draft'),
  priority: z.enum(applicationPriorities).optional().default('medium'),
  salaryMin: optionalSalary,
  salaryMax: optionalSalary,
  salaryCurrency: optionalCurrency,
  location: optionalText(160),
  employmentType: optionalText(80),
  workMode: optionalText(80),
  appliedAt: optionalDateOnly,
  notes: optionalText(10_000),
};

function validateSalaryFields(value: {
  salaryMin?: number | null | undefined;
  salaryMax?: number | null | undefined;
  salaryCurrency?: string | null | undefined;
}): boolean {
  if (
    value.salaryMin !== undefined &&
    value.salaryMax !== undefined &&
    value.salaryMin !== null &&
    value.salaryMax !== null &&
    value.salaryMin > value.salaryMax
  ) {
    return false;
  }

  if (
    (value.salaryMin !== undefined && value.salaryMin !== null) ||
    (value.salaryMax !== undefined && value.salaryMax !== null)
  ) {
    return value.salaryCurrency !== undefined && value.salaryCurrency !== null;
  }

  return true;
}

export const applicationIdParamsSchema = z
  .object({
    applicationId: z.string().uuid(),
  })
  .strict();

export const createApplicationSchema = z
  .object(applicationFieldsSchema)
  .strict()
  .refine(validateSalaryFields, {
    message: 'Salary currency is required when salary is provided, and min must be <= max',
  });

export const updateApplicationSchema = z
  .object({
    companyId: applicationFieldsSchema.companyId.optional(),
    contactId: applicationFieldsSchema.contactId,
    jobTitle: applicationFieldsSchema.jobTitle.optional(),
    jobUrl: applicationFieldsSchema.jobUrl,
    source: applicationFieldsSchema.source,
    status: z.enum(applicationStatuses).optional(),
    priority: z.enum(applicationPriorities).optional(),
    salaryMin: applicationFieldsSchema.salaryMin,
    salaryMax: applicationFieldsSchema.salaryMax,
    salaryCurrency: applicationFieldsSchema.salaryCurrency,
    location: applicationFieldsSchema.location,
    employmentType: applicationFieldsSchema.employmentType,
    workMode: applicationFieldsSchema.workMode,
    appliedAt: applicationFieldsSchema.appliedAt,
    notes: applicationFieldsSchema.notes,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one application field must be provided',
  })
  .refine(validateSalaryFields, {
    message: 'Salary currency is required when salary is provided, and min must be <= max',
  });

const paginationNumber = (defaultValue: number, maxValue: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined ? defaultValue : Number(value)))
    .pipe(z.number().int().min(1).max(maxValue));

export const listApplicationsQuerySchema = z
  .object({
    page: paginationNumber(1, 10_000),
    pageSize: paginationNumber(20, 100),
    search: z.string().trim().min(1).max(160).optional(),
    status: z.enum(applicationStatuses).optional(),
    priority: z.enum(applicationPriorities).optional(),
    companyId: z.string().uuid().optional(),
    contactId: z.string().uuid().optional(),
    source: z.string().trim().min(1).max(120).optional(),
    location: z.string().trim().min(1).max(160).optional(),
    employmentType: z.string().trim().min(1).max(80).optional(),
    workMode: z.string().trim().min(1).max(80).optional(),
    sortBy: z
      .enum([
        'jobTitle',
        'status',
        'priority',
        'companyName',
        'appliedAt',
        'createdAt',
        'updatedAt',
      ])
      .optional()
      .default('updatedAt'),
    sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .strict();

export type ApplicationIdParams = z.infer<typeof applicationIdParamsSchema>;
export type CreateApplicationBody = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationBody = z.infer<typeof updateApplicationSchema>;
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;
