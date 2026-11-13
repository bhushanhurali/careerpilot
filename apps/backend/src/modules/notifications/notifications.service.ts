import { QueryTypes } from 'sequelize';

import { sequelize } from '../../db/sequelize.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { activeApplicationJoins, openDatedTask, scheduledInterview } from './notification-scope.js';
import type { NotificationListQuery } from './notifications.schemas.js';
import type { NotificationDto } from './notifications.types.js';

// Recheck visibility against live sources so stale or mismatched rows cannot be read or marked.
const visibleNotifications = `
  WITH visible AS (
    SELECT n.*, a.id AS application_id, a.job_title, c.name AS company_name, NULL::text AS task_title
    FROM notifications n
    JOIN interviews source ON source.id = n.interview_id
    ${activeApplicationJoins}
    WHERE n.user_id = $userId::uuid AND a.user_id = n.user_id
      AND n.delivered_at <= statement_timestamp() AND ${scheduledInterview}
      AND source.scheduled_at = n.interview_scheduled_at
    UNION ALL
    SELECT n.*, a.id, a.job_title, c.name, source.title
    FROM notifications n
    JOIN tasks source ON source.id = n.task_id
    ${activeApplicationJoins}
    WHERE n.user_id = $userId::uuid AND a.user_id = n.user_id
      AND n.delivered_at <= statement_timestamp() AND ${openDatedTask}
      AND source.due_on = n.task_due_on
  )
`;

const listSql = `
  ${visibleNotifications},
  filtered AS (SELECT * FROM visible WHERE NOT $unread::boolean OR read_at IS NULL),
  page AS (
    SELECT id, type, application_id AS "applicationId", job_title AS "jobTitle",
      company_name AS "companyName", interview_id AS "interviewId",
      interview_scheduled_at,
      task_id AS "taskId", task_title AS "taskTitle", task_due_on AS "taskDueOn",
      scheduled_for, delivered_at, read_at
    FROM filtered ORDER BY delivered_at DESC, id DESC LIMIT $limit OFFSET $offset
  )
  SELECT (SELECT count(*)::int FROM filtered) AS total,
    (SELECT count(*)::int FROM visible WHERE read_at IS NULL) AS "unreadCount",
    coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'type', type, 'applicationId', "applicationId", 'jobTitle', "jobTitle",
      'companyName', "companyName", 'interviewId', "interviewId",
      'interviewScheduledAt', to_char(interview_scheduled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'taskId', "taskId", 'taskTitle', "taskTitle", 'taskDueOn', "taskDueOn",
      'scheduledFor', to_char(scheduled_for AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'deliveredAt', to_char(delivered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'readAt', to_char(read_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) ORDER BY delivered_at DESC, id DESC) FROM page), '[]'::jsonb) AS notifications
`;

export class NotificationsService {
  async list(userId: string, query: NotificationListQuery) {
    const [result] = await sequelize.query<{
      total: number;
      unreadCount: number;
      notifications: NotificationDto[];
    }>(listSql, {
      bind: {
        userId,
        unread: query.unread,
        limit: query.pageSize,
        offset: (query.page - 1) * query.pageSize,
      },
      type: QueryTypes.SELECT,
    });
    if (!result) throw new Error('Expected notification inbox summary');

    return {
      notifications: result.notifications,
      unreadCount: result.unreadCount,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const [result] = await sequelize.query<{ id: string; readAt: Date }>(
      `
      ${visibleNotifications},
      updated AS (
        UPDATE notifications n SET
          read_at = coalesce(n.read_at, statement_timestamp()),
          updated_at = CASE WHEN n.read_at IS NULL THEN statement_timestamp() ELSE n.updated_at END
        WHERE n.id = $notificationId::uuid AND n.user_id = $userId::uuid
          AND EXISTS (SELECT 1 FROM visible v WHERE v.id = n.id)
        RETURNING n.id, n.read_at AS "readAt"
      )
      SELECT * FROM updated
    `,
      { bind: { userId, notificationId }, type: QueryTypes.SELECT },
    );
    if (!result) throw new HttpError(404, 'NOTIFICATION_NOT_FOUND', 'Notification was not found');
    return { id: result.id, readAt: result.readAt.toISOString() };
  }
}
