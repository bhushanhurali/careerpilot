import { z } from 'zod';

import type { TaskPriority } from '../../db/models/task.model.js';
import { applicationIdParamsSchema } from '../applications/applications.schemas.js';

const priorities = ['low', 'medium', 'high'] as const satisfies readonly TaskPriority[];
const calendarDate = z
  .string()
  .date()
  .refine((value) => !value.startsWith('0000-'), {
    message: 'Use a calendar year from 0001 to 9999',
  });
const emptyStringToNull = (value: unknown): unknown =>
  typeof value === 'string' && value.trim().length === 0 ? null : value;
const hasNoNullCharacter = (value: string): boolean => !value.includes('\0');

export const taskDetailParamsSchema = applicationIdParamsSchema.extend({
  taskId: z.string().uuid(),
});

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(160).refine(hasNoNullCharacter, {
      message: 'Title must not contain null characters',
    }),
    notes: z
      .preprocess(
        emptyStringToNull,
        z
          .string()
          .trim()
          .max(10_000)
          .refine(hasNoNullCharacter, {
            message: 'Notes must not contain null characters',
          })
          .nullable(),
      )
      .optional(),
    dueOn: calendarDate.nullable().optional(),
    priority: z.enum(priorities).optional(),
  })
  .strict();

export const updateTaskSchema = createTaskSchema
  .partial()
  .extend({ completed: z.boolean().optional() })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one task field must be provided',
  });

const paginationNumber = (defaultValue: number, maxValue: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined ? defaultValue : Number(value)))
    .pipe(z.number().int().min(1).max(maxValue));

export const listTasksQuerySchema = z
  .object({
    page: paginationNumber(1, 10_000),
    pageSize: paginationNumber(20, 100),
    status: z.enum(['open', 'completed']).optional(),
    priority: z.enum(priorities).optional(),
    due: z.enum(['overdue', 'today', 'upcoming', 'undated']).optional(),
    today: calendarDate.optional(),
    sortBy: z.enum(['dueOn', 'priority', 'createdAt', 'completedAt']).default('dueOn'),
    sortDirection: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict()
  .refine((query) => !query.due || query.due === 'undated' || query.today !== undefined, {
    message: 'Today is required for relative due-date filters',
    path: ['today'],
  });

export type CreateTaskBody = z.infer<typeof createTaskSchema>;
export type UpdateTaskBody = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
