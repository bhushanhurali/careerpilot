# Database Plan

CareerPilot uses PostgreSQL through Sequelize. Umzug runs Sequelize migration files and records
completed migrations in PostgreSQL.

Every schema change must be represented as a migration in:

```text
apps/backend/src/db/migrations
```

Development, demo, and test seed data will live in:

```text
apps/backend/src/db/seeds
```

## Current Tables

- `users`: user identity, bcrypt password hash, role, active flag, and timestamps.
- `refresh_tokens`: hashed refresh credentials, expiry, revocation, token family, and replacement
  relationship.
- `SequelizeMeta`: migration names applied by Umzug's Sequelize storage.

The application does not use `sequelize.sync()`. Migrations are the only supported way to change
the schema.

Run pending migrations:

```bash
pnpm --filter @careerpilot/backend migrate:up
```

Roll back the latest migration:

```bash
pnpm --filter @careerpilot/backend migrate:down
```

## Decisions

- Use migrations from the beginning so database history is reproducible.
- Use seeds only for controlled development, demo, and test data.
- Keep one migration system: Sequelize models plus Umzug/Sequelize migrations.
- Store refresh-token hashes rather than raw bearer credentials.
- Avoid creating job-search business tables before the corresponding feature phase.
