import { z } from 'zod';

const emptyStringToNull = (value: unknown): unknown =>
  typeof value === 'string' && value.trim().length === 0 ? null : value;

const optionalText = (max: number) =>
  z.preprocess(emptyStringToNull, z.string().trim().max(max).nullable()).optional();

const optionalEmail = z
  .preprocess(emptyStringToNull, z.string().trim().email().max(320).nullable())
  .transform((value) => (value ? value.toLowerCase() : null))
  .optional();

const optionalUrl = z
  .preprocess(emptyStringToNull, z.string().trim().url().max(2048).nullable())
  .optional();

const contactFieldsSchema = {
  firstName: z.string().trim().min(1).max(80),
  lastName: optionalText(80),
  email: optionalEmail,
  phone: optionalText(40),
  roleTitle: optionalText(120),
  linkedInUrl: optionalUrl,
  notes: optionalText(10_000),
};

export const contactListParamsSchema = z
  .object({
    companyId: z.string().uuid(),
  })
  .strict();

export const contactDetailParamsSchema = z
  .object({
    companyId: z.string().uuid(),
    contactId: z.string().uuid(),
  })
  .strict();

export const createContactSchema = z.object(contactFieldsSchema).strict();

export const updateContactSchema = z
  .object({
    firstName: contactFieldsSchema.firstName.optional(),
    lastName: contactFieldsSchema.lastName,
    email: contactFieldsSchema.email,
    phone: contactFieldsSchema.phone,
    roleTitle: contactFieldsSchema.roleTitle,
    linkedInUrl: contactFieldsSchema.linkedInUrl,
    notes: contactFieldsSchema.notes,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one contact field must be provided',
  });

const paginationNumber = (defaultValue: number, maxValue: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined ? defaultValue : Number(value)))
    .pipe(z.number().int().min(1).max(maxValue));

export const listContactsQuerySchema = z
  .object({
    page: paginationNumber(1, 10_000),
    pageSize: paginationNumber(20, 100),
    search: z.string().trim().min(1).max(160).optional(),
    sortBy: z
      .enum(['firstName', 'lastName', 'createdAt', 'updatedAt'])
      .optional()
      .default('createdAt'),
    sortDirection: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .strict();

export type ContactListParams = z.infer<typeof contactListParamsSchema>;
export type ContactDetailParams = z.infer<typeof contactDetailParamsSchema>;
export type CreateContactBody = z.infer<typeof createContactSchema>;
export type UpdateContactBody = z.infer<typeof updateContactSchema>;
export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;
