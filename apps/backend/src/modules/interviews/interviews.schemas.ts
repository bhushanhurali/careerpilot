import { z } from 'zod';

import type { InterviewStatus, InterviewType } from '../../db/models/interview.model.js';
import { applicationIdParamsSchema } from '../applications/applications.schemas.js';

const interviewTypes = [
  'phone_screen',
  'recruiter_screen',
  'technical',
  'coding',
  'system_design',
  'hiring_manager',
  'onsite',
  'hr',
  'final',
  'other',
] as const satisfies readonly InterviewType[];

const interviewStatuses = [
  'scheduled',
  'completed',
  'cancelled',
  'rescheduled',
  'no_show',
] as const satisfies readonly InterviewStatus[];

const emptyStringToNull = (value: unknown): unknown =>
  typeof value === 'string' && value.trim().length === 0 ? null : value;

const optionalText = (max: number) =>
  z.preprocess(emptyStringToNull, z.string().trim().max(max).nullable()).optional();

const interviewFieldsSchema = {
  type: z.enum(interviewTypes),
  status: z.enum(interviewStatuses),
  scheduledAt: z
    .string()
    .datetime({ offset: true })
    .refine((value) => Number.isFinite(Date.parse(value)), {
      message: 'Scheduled time must be a valid ISO datetime',
    }),
  durationMinutes: z.number().int().positive().max(2_147_483_647).nullable().optional(),
  location: optionalText(160),
  meetingUrl: z
    .preprocess(
      emptyStringToNull,
      z
        .string()
        .trim()
        .url()
        .max(2048)
        .regex(/^https?:\/\//i)
        .nullable(),
    )
    .optional(),
  notes: optionalText(10_000),
};

export const interviewDetailParamsSchema = applicationIdParamsSchema.extend({
  interviewId: z.string().uuid(),
});

export const createInterviewSchema = z.object(interviewFieldsSchema).strict();

export const updateInterviewSchema = createInterviewSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one interview field must be provided',
  });

export type CreateInterviewBody = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewBody = z.infer<typeof updateInterviewSchema>;
