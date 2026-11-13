import { QueryTypes } from 'sequelize';

import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { sequelize } from '../../db/sequelize.js';
import { activeApplicationJoins, openDatedTask, scheduledInterview } from './notification-scope.js';

// Materialize only due events. The event keys, not poll time, survive retries and restarts.
const deliverRemindersSql = `
  WITH bounds AS (
    SELECT $asOf::timestamptz AS now, ($asOf::timestamptz AT TIME ZONE $timeZone)::date AS today
  ),
  candidates AS (
    SELECT a.user_id, 'interview_reminder' AS type, source.id AS interview_id,
      NULL::uuid AS task_id, source.scheduled_at AS interview_scheduled_at,
      NULL::date AS task_due_on, source.scheduled_at - interval '24 hours' AS scheduled_for
    FROM interviews source
    ${activeApplicationJoins}
    CROSS JOIN bounds b
    WHERE ${scheduledInterview}
      AND source.scheduled_at > b.now AND source.scheduled_at <= b.now + interval '24 hours'
    UNION ALL
    SELECT a.user_id, CASE WHEN source.due_on = b.today THEN 'task_due' ELSE 'task_overdue' END,
      NULL::uuid, source.id, NULL::timestamptz, source.due_on,
      (source.due_on + CASE WHEN source.due_on < b.today THEN 1 ELSE 0 END)::timestamp
        AT TIME ZONE $timeZone
    FROM tasks source
    ${activeApplicationJoins}
    CROSS JOIN bounds b
    WHERE ${openDatedTask} AND source.due_on <= b.today
  ),
  delivered_pending AS (
    UPDATE notifications n SET delivered_at = b.now, updated_at = b.now
    FROM candidates e CROSS JOIN bounds b
    WHERE n.user_id = e.user_id AND n.type = e.type AND n.delivered_at IS NULL
      AND e.scheduled_for <= b.now AND n.scheduled_for <= b.now
      AND ((n.interview_id = e.interview_id AND n.interview_scheduled_at = e.interview_scheduled_at)
        OR (n.task_id = e.task_id AND n.task_due_on = e.task_due_on))
  )
  INSERT INTO notifications (id, user_id, type, interview_id, task_id, interview_scheduled_at,
    task_due_on, scheduled_for, delivered_at, created_at, updated_at)
  SELECT gen_random_uuid(), e.user_id, e.type, e.interview_id, e.task_id, e.interview_scheduled_at,
    e.task_due_on, e.scheduled_for, b.now, b.now, b.now
  FROM candidates e CROSS JOIN bounds b
  WHERE e.scheduled_for <= b.now
  ON CONFLICT DO NOTHING
`;

export async function processReminders(
  asOf = new Date(),
  timeZone = env.REMINDER_TIME_ZONE,
): Promise<void> {
  await sequelize.query(deliverRemindersSql, {
    bind: { asOf: asOf.toISOString(), timeZone },
    type: QueryTypes.INSERT,
  });
}

export function startReminderScheduler(): () => void {
  let running = false;
  const tick = () => {
    if (running) return;
    running = true;
    void processReminders()
      .catch((error: unknown) => logger.error({ error }, 'Reminder processing failed'))
      .finally(() => {
        running = false;
      });
  };
  const timer = setInterval(tick, 60_000);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
