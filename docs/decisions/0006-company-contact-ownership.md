# ADR 0006: Company and Contact Ownership Model

## Status

Accepted

## Context

Phase 2 introduces the first job-search domain data: companies and recruiter contacts. Every record
must belong to the authenticated user, and cross-user access must be prevented. Contacts are useful
only in the context of a company at this stage.

## Decision

Companies store direct ownership through `companies.user_id`.

Contacts do not store `user_id`. They store `contacts.company_id`, and ownership is derived by
verifying that the parent company belongs to the authenticated user before any contact operation.

Contacts are exposed through nested routes only:

```text
/api/v1/companies/:companyId/contacts
```

Both companies and contacts use Sequelize paranoid soft deletion. Company deletion explicitly
soft-deletes active contacts in the Company service inside a database transaction.

Cross-user access returns `404` instead of `403`.

## Consequences

- The ownership model is simple and easy to reason about.
- Contact data cannot accidentally drift away from its company owner.
- Every contact operation pays the cost of verifying the parent company, but this keeps
  authorization explicit and safe.
- Global contact search is deferred until there is a product need for it.
- If global contact workflows are added later, they can still query through companies owned by the
  authenticated user.

## Alternatives Considered

### Store `user_id` on both companies and contacts

This can make some queries faster, but it duplicates ownership data. It also creates consistency
risks if a contact's `user_id` ever disagrees with its company's `user_id`.

### Add top-level contact routes immediately

This would make Contacts feel like a separate product area before there is a real cross-company
workflow. Nested routes are clearer for the current domain and reduce authorization ambiguity.

### Use a PostgreSQL trigger for soft-delete propagation

A trigger could automatically soft-delete contacts when a company is soft-deleted. Phase 2 keeps
this behavior in the service layer because it is easier to test, easier to explain, and avoids
hidden database behavior while the project is still evolving.
