# ADR 0008: Application Status History

## Status

Accepted

## Context

Phase 4 adds lifecycle history to job applications. Phase 3 stored only the current status on
`job_applications`, which is useful for pipeline filtering but cannot answer when or why a status
changed.

The design needs to preserve the existing top-level application workflow, keep authorization
simple, support existing records, and avoid status changes bypassing history.

## Decision

Add `application_status_history` as an append-only child table of `job_applications`.

History rows store:

```text
application_id, from_status, to_status, changed_at, note, created_at, updated_at
```

History rows do not store `user_id`. Ownership is derived by verifying the parent
`job_applications` row belongs to the authenticated user.

Keep `job_applications.status` as the denormalized current status. This keeps list filtering,
sorting, and dashboard-style queries simple while status history remains the audit trail.

Create one initial history row when an application is created. Backfill one initial row for every
existing application, including soft-deleted applications, with `from_status = null`,
`to_status = job_applications.status`, and `changed_at = job_applications.created_at`.

Status changes happen through:

```text
POST /api/v1/applications/:applicationId/status-transitions
```

The transition service updates `job_applications.status` and inserts the history row in one
database transaction. Same-status transitions are rejected with `STATUS_UNCHANGED`. Normal
`PATCH /applications/:applicationId` no longer accepts `status`.

## Consequences

- The current application status remains cheap to query.
- The application detail page can render an oldest-first status timeline.
- Status changes have a single backend write path.
- Cross-user status-history access returns `404` because parent application lookup is ownership
  scoped.
- Soft-deleting an application keeps history in the database, but normal API routes hide it because
  they require an active owned parent application.
- Hard-deleting an application physically cascades its history rows.

## Alternatives Considered

### Derive current status from latest history row

This would avoid denormalization, but every list/filter/sort query would need to join or compute the
latest history row. Keeping `job_applications.status` matches the existing pipeline API and is
simpler for future dashboard queries.

### Store `user_id` on history rows

Duplicating `user_id` would make direct history queries easy, but status history is not an
independent top-level resource. Deriving ownership through the parent application avoids redundant
ownership data and keeps the authorization model consistent.

### Allow editing history rows

History correction could be useful later, but Phase 4 keeps history append-only so the timeline is
trustworthy and the workflow stays focused.
