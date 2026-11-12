import { z } from 'zod';

export const dashboardQuerySchema = z
  .object({
    today: z
      .string()
      .date()
      .refine((value) => !value.startsWith('0000-'), {
        message: 'Use a calendar year from 0001 to 9999',
      })
      .optional(),
  })
  .strict();
