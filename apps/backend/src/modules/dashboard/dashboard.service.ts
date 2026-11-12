import { QueryTypes } from 'sequelize';

import { sequelize } from '../../db/sequelize.js';
import { applicationStatuses } from '../applications/applications.schemas.js';
import { DashboardDto } from './dashboard.types.js';

type DashboardRow = Omit<DashboardDto, 'today' | 'asOf'>;

// Reuse the same ownership scope for every metric and read all sections in one database snapshot.
const dashboardSql = `
  WITH bounds AS (
    SELECT CAST($today AS date) AS today,
      date_trunc('month', CAST($today AS timestamp))::date AS month_start,
      CAST($asOf AS timestamptz) AS as_of
  ),
  owned_applications AS (
    SELECT a.id, a.job_title, a.status, a.applied_at, a.updated_at, c.name AS company_name
    FROM job_applications a
    JOIN companies c ON c.id = a.company_id AND c.user_id = a.user_id AND c.deleted_at IS NULL
    WHERE a.user_id = CAST($userId AS uuid) AND a.deleted_at IS NULL
  ),
  months AS (
    SELECT generate_series(
      month_start - INTERVAL '5 months', month_start, INTERVAL '1 month'
    ) AS month
    FROM bounds
  ),
  trend_counts AS (
    SELECT date_trunc('month', a.applied_at::timestamp) AS month, count(*) AS count
    FROM owned_applications a CROSS JOIN bounds b
    WHERE a.applied_at >= b.month_start - INTERVAL '5 months' AND a.applied_at <= b.today
    GROUP BY 1
  ),
  scheduled_interviews AS (
    SELECT i.id, i.type, i.scheduled_at, a.id AS application_id, a.job_title, a.company_name
    FROM interviews i
    JOIN owned_applications a ON a.id = i.application_id
    CROSS JOIN bounds b
    WHERE i.deleted_at IS NULL AND i.status = 'scheduled' AND i.scheduled_at >= b.as_of
  ),
  dated_open_tasks AS (
    SELECT t.id, t.title, t.due_on, t.priority, a.id AS application_id, a.job_title, a.company_name
    FROM tasks t
    JOIN owned_applications a ON a.id = t.application_id
    CROSS JOIN bounds b
    WHERE t.deleted_at IS NULL AND t.completed_at IS NULL AND t.due_on < b.today + 7
  ),
  overdue AS (
    SELECT t.* FROM dated_open_tasks t CROSS JOIN bounds b WHERE t.due_on < b.today
  ),
  upcoming AS (
    SELECT t.* FROM dated_open_tasks t CROSS JOIN bounds b WHERE t.due_on >= b.today
  )
  SELECT
    jsonb_build_object(
      'activeApplications', (SELECT count(*) FROM owned_applications
        WHERE status NOT IN ('accepted', 'rejected', 'withdrawn')),
      'applicationsSubmittedThisMonth', (SELECT count(*) FROM owned_applications a CROSS JOIN bounds b
        WHERE a.applied_at BETWEEN b.month_start AND b.today),
      'upcomingInterviews', (SELECT count(*) FROM scheduled_interviews),
      'offersReceived', (SELECT count(*) FROM owned_applications a WHERE EXISTS (
        SELECT 1 FROM application_status_history h WHERE h.application_id = a.id AND h.to_status = 'offer'
      )),
      'overdueTasks', (SELECT count(*) FROM overdue)
    ) AS kpis,
    (
      SELECT jsonb_agg(jsonb_build_object('status', s.status, 'count', coalesce(d.count, 0))
        ORDER BY s.position)
      FROM unnest(CAST($statuses AS text[])) WITH ORDINALITY AS s(status, position)
      LEFT JOIN (SELECT status, count(*) AS count FROM owned_applications GROUP BY status) d
        ON d.status = s.status
    ) AS "statusDistribution",
    (
      SELECT jsonb_agg(jsonb_build_object('month', to_char(m.month, 'YYYY-MM'), 'count', coalesce(t.count, 0))
        ORDER BY m.month)
      FROM months m LEFT JOIN trend_counts t USING (month)
    ) AS "submissionTrend",
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'type', i.type, 'scheduledAt', i.scheduled_at,
        'applicationId', i.application_id, 'jobTitle', i.job_title, 'companyName', i.company_name
      ) ORDER BY i.scheduled_at, i.id), '[]'::jsonb)
      FROM (SELECT * FROM scheduled_interviews ORDER BY scheduled_at, id LIMIT 5) i
    ) AS "upcomingInterviews",
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'title', t.title, 'dueOn', t.due_on, 'priority', t.priority,
        'applicationId', t.application_id, 'jobTitle', t.job_title, 'companyName', t.company_name
      ) ORDER BY t.due_on, t.id), '[]'::jsonb)
      FROM (SELECT * FROM overdue ORDER BY due_on, id LIMIT 5) t
    ) AS "overdueTasks",
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'title', t.title, 'dueOn', t.due_on, 'priority', t.priority,
        'applicationId', t.application_id, 'jobTitle', t.job_title, 'companyName', t.company_name
      ) ORDER BY t.due_on, t.id), '[]'::jsonb)
      FROM (SELECT * FROM upcoming ORDER BY due_on, id LIMIT 5) t
    ) AS "upcomingTasks",
    (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'jobTitle', a.job_title, 'companyName', a.company_name,
        'status', a.status, 'updatedAt', a.updated_at
      ) ORDER BY a.updated_at DESC, a.id), '[]'::jsonb)
      FROM (SELECT * FROM owned_applications ORDER BY updated_at DESC, id LIMIT 5) a
    ) AS "recentApplications"
`;

export class DashboardService {
  async getDashboard(userId: string, localToday?: string): Promise<DashboardDto> {
    const asOf = new Date().toISOString();
    const today = localToday ?? asOf.slice(0, 10);
    const [row] = await sequelize.query<DashboardRow>(dashboardSql, {
      bind: { userId, today, asOf, statuses: applicationStatuses },
      type: QueryTypes.SELECT,
    });

    if (!row) {
      throw new Error('Dashboard aggregate query returned no row');
    }

    return {
      ...row,
      today,
      asOf,
      upcomingInterviews: row.upcomingInterviews.map((interview) => ({
        ...interview,
        scheduledAt: new Date(interview.scheduledAt).toISOString(),
      })),
      recentApplications: row.recentApplications.map((application) => ({
        ...application,
        updatedAt: new Date(application.updatedAt).toISOString(),
      })),
    };
  }
}
