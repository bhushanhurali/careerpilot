# ADR 0010: Application Tasks and Calendar Due Dates

## Status

Accepted

## Context

Follow-ups belong to applications, but users need one place to see what is due across their
pipeline. Unlike interviews, a follow-up can be due on a day without having a scheduled time.

## Decision

- Store tasks under one required application, without a duplicate user ID or an interview link.
  Derive access through an active owned application and company.
- Offer a read-only cross-application list, with all writes scoped under the parent application.
  Both frontend views use the same nested PATCH for completion and reopening.
- Use a nullable `completed_at` as the source of completion state. The server sets it on
  completion, preserves it on repeated completion, and clears it on reopening.
- Store optional due dates as PostgreSQL `date` and API `YYYY-MM-DD`. Compare them with the
  caller's local calendar date before pagination; do not persist overdue status.
- Soft-delete individual tasks. Soft-deleting an application or company retains but hides tasks;
  physically deleting an application cascades to its tasks.

## Consequences

- The Tasks page can filter and paginate across applications without a second write API.
- Users in different timezones may see different due buckets for the same date at the same
  instant. The date itself never changes with timezone.
- The UI samples the local date on list requests and does not automatically reload at midnight.
- Direct interview links, notifications, calendars, and dashboards are outside Phase 6.

## Alternatives Considered

- A timestamp and timezone would enable time-specific reminders, but that is not the current
  workflow and would introduce unnecessary conversion rules.
- A separate status field could represent more states later, but would duplicate the completion
  timestamp for the current open/completed workflow.
