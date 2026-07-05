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
- `companies`: authenticated user's companies, optional profile fields, timestamps, and soft-delete
  timestamp.
- `contacts`: recruiter or hiring contacts that belong to one company, optional communication
  fields, timestamps, and soft-delete timestamp.
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
- Add business tables only when the corresponding feature phase implements and tests them.
- Use `companies.user_id` for direct ownership and derive contact ownership through the parent
  company.
- Use Sequelize paranoid soft deletion for companies and contacts.
- Implement company/contact soft-delete propagation explicitly in the service layer inside a
  transaction, not with a PostgreSQL trigger.

## Companies

`companies` is the parent aggregate for Phase 2 and future job applications.

| Column       | Type          | Required | Notes                                   |
| ------------ | ------------- | -------- | --------------------------------------- |
| `id`         | UUID          | Yes      | Primary key                             |
| `user_id`    | UUID          | Yes      | FK to `users.id`; owner of the company  |
| `name`       | varchar(160)  | Yes      | Trimmed, non-empty                      |
| `website`    | varchar(2048) | No       | Validated by the API as a URL           |
| `industry`   | varchar(120)  | No       | Optional filter field                   |
| `location`   | varchar(160)  | No       | Optional filter field                   |
| `notes`      | text          | No       | User notes                              |
| `created_at` | timestamp     | Yes      | Managed by Sequelize                    |
| `updated_at` | timestamp     | Yes      | Managed by Sequelize                    |
| `deleted_at` | timestamp     | No       | Set by Sequelize paranoid soft deletion |

Important constraints and indexes:

- `companies_name_trimmed_not_empty_check` prevents whitespace-only names.
- `companies_user_id_idx` supports ownership-scoped queries.
- `companies_user_id_name_idx` supports sorting/filtering by name per user.
- `companies_user_id_name_active_unique` prevents duplicate active company names for the same
  user using `lower(btrim(name))`.

Different users may create companies with the same name. A user may reuse a company name after the
previous company has been soft-deleted.

## Contacts

`contacts` belongs to `companies`. It does not store `user_id`; ownership is derived from the
parent company.

| Column          | Type          | Required | Notes                                   |
| --------------- | ------------- | -------- | --------------------------------------- |
| `id`            | UUID          | Yes      | Primary key                             |
| `company_id`    | UUID          | Yes      | FK to `companies.id`                    |
| `first_name`    | varchar(80)   | Yes      | Trimmed, non-empty                      |
| `last_name`     | varchar(80)   | No       | Optional                                |
| `email`         | varchar(320)  | No       | Lowercased by the API when provided     |
| `phone`         | varchar(40)   | No       | Optional                                |
| `role_title`    | varchar(120)  | No       | Optional recruiter/hiring role          |
| `linked_in_url` | varchar(2048) | No       | Validated by the API as a URL           |
| `notes`         | text          | No       | User notes                              |
| `created_at`    | timestamp     | Yes      | Managed by Sequelize                    |
| `updated_at`    | timestamp     | Yes      | Managed by Sequelize                    |
| `deleted_at`    | timestamp     | No       | Set by Sequelize paranoid soft deletion |

Important constraints and indexes:

- `contacts_first_name_trimmed_not_empty_check` prevents whitespace-only first names.
- `contacts_company_id_idx` supports nested route lookups.
- `contacts_company_id_name_idx` supports deterministic name sorting within a company.
- `contacts_company_id_email_idx` supports email lookup/search within a company.

## Test Database Safety

Backend integration tests run with `NODE_ENV=test` and require a database name containing `test`.
The Vitest setup resolves the final `DATABASE_URL`, parses the database name, and refuses to run if
the name does not include `test`. This protects the development database from destructive cleanup
used in integration tests.

The default test database URL is:

```text
postgres://careerpilot:careerpilot_dev_password@localhost:5432/careerpilot_test
```
