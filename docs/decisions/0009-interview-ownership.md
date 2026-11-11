# ADR 0009: Interview Ownership and Lifecycle

## Status

Accepted

## Context

Phase 5 lets users track interviews in the context of a job application. A user may have several
interviews for one application, and the schedule or outcome of one interview does not necessarily
change the overall application status.

## Decision

- Store interviews as children of `job_applications` via required `application_id`. Do not
  duplicate `user_id` on interviews.
- Expose authenticated list, create, update, and delete operations only under
  `/api/v1/applications/:applicationId/interviews`. Verify an active owned application and company,
  then scope item mutations by both interview and application IDs.
- Embed interview management in the application detail page without standalone routes.
- Store the schedule as an instant. The API requires a timezone-qualified timestamp and
  serializes it in UTC; the frontend displays and edits it in browser local time.
- Keep interview status independent of application status and its append-only history.
- Use paranoid soft deletion for interviews. Soft-deleting a parent application retains its
  interviews but hides them through the normal API. Physical parent deletion cascades.

## Consequences

- Interview access follows the application's ownership and visibility rules; missing and
  unauthorized resources use the same `404` response.
- Rescheduling updates the interview record. There is no interview history or automatic
  application-status transition.
- Cross-application views, reminders, calendar integration, and dashboard summaries are out of
  scope for Phase 5.

## Alternatives Considered

- A top-level interview resource or copied `user_id` would simplify some global queries, but adds
  a second way to access the resource or represent ownership before there is a workflow that needs it.
- An interview event log would preserve past schedules, but the current workflow only needs the
  latest schedule and status.
