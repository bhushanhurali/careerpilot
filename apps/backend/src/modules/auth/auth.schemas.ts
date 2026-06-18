import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long')
  .max(128, 'Password must be at most 128 characters long');

export const registerSchema = z
  .object({
    email: z.string().email().max(320).trim().toLowerCase(),
    password: passwordSchema,
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().email().max(320).trim().toLowerCase(),
    password: z.string().min(1).max(128),
  })
  .strict();

export type RegisterBody = z.infer<typeof registerSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
