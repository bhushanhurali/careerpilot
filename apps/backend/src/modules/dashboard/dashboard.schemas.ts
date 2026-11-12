import { z } from 'zod';

export const dashboardQuerySchema = z
  .object({
    today: z
      .string()
      .date()
      .refine((value) => value >= '0001-06-01', {
        message: 'Use a date on or after 0001-06-01 so all six trend months have a calendar year',
      })
      .optional(),
  })
  .strict();
