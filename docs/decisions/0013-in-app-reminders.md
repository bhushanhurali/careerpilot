# ADR 0013: PostgreSQL In-App Reminders

## Status

Accepted

## Decision

- Deliver in-app reminders from the backend with a minute poll. Use PostgreSQL event
  uniqueness and persisted delivery/read timestamps rather than a separate queue.
- An Interview reminder is eligible 24 elapsed hours before a scheduled Interview and
  expires for delivery when it starts. Task reminders use date-only source values and
  deployment-wide IANA midnight boundaries: the due day and the first overdue day.
- Keep historical event keys after source edits. Recheck live ownership, status, and
  source identity whenever serving inbox items.

## Consequences

- After downtime, upcoming eligible Interviews and open overdue Tasks catch up, but
  expired Interview or due-day reminders are not replayed.
- Users share one timezone for Task reminders. Changing it does not reset deduplication.
- Restoring the exact event can expose its original notification with its original read
  state. There is no automatic notification pruning or delivery while the backend is stopped.
