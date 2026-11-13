import { z } from 'zod';

export const resumeIdParams = z.object({ resumeId: z.string().uuid() }).strict();
export const resumeUploadBody = z
  .object({
    title: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .refine((value) => !value.includes('\0')),
  })
  .strict();
