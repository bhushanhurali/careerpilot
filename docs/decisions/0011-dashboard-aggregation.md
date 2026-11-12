# ADR 0011: Dashboard Aggregation and Date Boundaries

## Status

Accepted

## Decision

- Return a read-only dashboard summary from one PostgreSQL statement through Sequelize. Reuse
  one authenticated application-and-company scope, and exclude soft-deleted records.
- Aggregate counts and trends in PostgreSQL and return only bounded previews. The Angular
  client renders the results rather than fetching full lists and calculating metrics.
- Use `applied_at` for submissions, current status for pipeline distribution, and recorded
  status history for distinct applications that received an offer.
- Use the caller's calendar date for submission and task buckets, with a UTC-date fallback.
  Select future interviews using the server's current instant instead. Task due dates and trend
  months are rendered without timezone shifts; interview and activity timestamps render locally.

## Consequences

- The sections share one database snapshot; no migration or cache is needed.
- Offer counts cannot recover events absent from status history. Metrics reflect records that
  are currently visible, not the historical visibility of records at each point in time.
- The dashboard is a snapshot at load or retry, not a live-updating feed.
