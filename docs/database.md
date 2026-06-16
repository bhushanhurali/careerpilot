# Database Plan

Phase 0 creates the migration and seed structure only.

Business tables will start in later phases. Every schema change must be represented as a migration in:

```text
apps/backend/src/db/migrations
```

Development, demo, and test seed data will live in:

```text
apps/backend/src/db/seeds
```

## Decisions

- Use migrations from the beginning so database history is reproducible.
- Use seeds only for controlled development, demo, and test data.
- Avoid creating business tables before the corresponding feature phase.
