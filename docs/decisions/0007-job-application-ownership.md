# ADR 0007: Job Application Ownership and Routing

## Status

Accepted

## Context

Phase 3 introduces job applications as the user's main pipeline resource. Applications must belong
to the authenticated user, must be linked to an owned company, and may optionally reference a
contact from that company. The design also needs to prepare for future status history, interviews,
notes, dashboard statistics, and CV linking.

## Decision

Job applications store direct ownership through `job_applications.user_id`.

Each application requires `company_id`. The backend verifies that the selected company belongs to
the authenticated user before creating or updating an application.

`contact_id` is optional. When present, the backend verifies that the contact belongs to the
selected company. A contact from another company is rejected with `CONTACT_COMPANY_MISMATCH`.

Applications use top-level API and frontend routes:

```text
/api/v1/applications
/applications
```

Applications use Sequelize paranoid soft deletion. Phase 3 stores only the current status on the
application record; immutable status history is deferred to Phase 4.

Cross-user access returns `404` instead of `403`.

## Consequences

- Application list/detail/update/delete queries can be scoped directly by authenticated user ID.
- The main pipeline is easy to query and paginate without nesting under companies.
- Company and contact relationships still stay safe because the service validates ownership and
  company/contact consistency.
- The schema supports future dashboard queries through ownership, status, company, contact,
  applied-date, updated-date, and title indexes.
- Status history can be added later without changing the meaning of the current status column.
- Company deletion behavior for existing applications remains a future product decision.

## Alternatives Considered

### Derive ownership only through company

Applications could omit `user_id` and derive ownership through `companies.user_id`. This reduces
duplication but makes every application query depend on joining companies. Because applications are
the main pipeline resource, direct ownership is simpler and safer for list, detail, update, and
dashboard queries.

### Nest applications under companies

Nested routes such as `/companies/:companyId/applications` would make company context explicit,
but users usually manage applications across all companies. Top-level routes better match the
product workflow while still validating the selected company.

### Enforce duplicate-application uniqueness

The database could prevent duplicate role/company combinations. Phase 3 intentionally avoids this
because users may apply to similar roles at the same company, reapply later, or track separate job
postings with the same title.

### Implement status history immediately

Status history is valuable, but it is a separate lifecycle feature. Phase 3 keeps CRUD focused and
leaves immutable status transitions for Phase 4.
