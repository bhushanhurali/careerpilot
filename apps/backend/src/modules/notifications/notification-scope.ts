export const activeApplicationJoins = `
  JOIN job_applications a ON a.id = source.application_id AND a.deleted_at IS NULL
  JOIN companies c ON c.id = a.company_id AND c.user_id = a.user_id AND c.deleted_at IS NULL
  JOIN users u ON u.id = a.user_id AND u.deleted_at IS NULL AND u.is_active
`;

export const scheduledInterview = "source.deleted_at IS NULL AND source.status = 'scheduled'";
export const openDatedTask =
  'source.deleted_at IS NULL AND source.completed_at IS NULL AND source.due_on IS NOT NULL';
