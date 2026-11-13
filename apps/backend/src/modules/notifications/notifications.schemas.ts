import { z } from 'zod';

export const notificationIdParams = z.object({ notificationId: z.string().uuid() }).strict();
export const notificationListQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    unread: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .strict();

export type NotificationListQuery = z.infer<typeof notificationListQuery>;
