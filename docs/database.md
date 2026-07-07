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
- `job_applications`: authenticated user's application pipeline entries linked to one company and
  optionally one contact, with status, priority, salary, applied-date, notes, timestamps, and
  soft-delete timestamp.
- `application_status_history`: append-only status timeline entries for job applications, linked
  to their parent application and retained through normal soft deletion.
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
- Store `job_applications.user_id` directly because applications are queried through top-level
  pipeline routes.
- Require every job application to reference an owned company. Optional contacts must belong to the
  selected company.
- Use Sequelize paranoid soft deletion for job applications.
- Keep `job_applications.status` as the denormalized current status for fast pipeline filters and
  sorting.
- Store append-only status changes in `application_status_history`.
- Derive status-history ownership through the parent job application instead of duplicating
  `user_id` on history rows.
- Create the initial status-history row transactionally when an application is created.
- Backfill one initial status-history row for every existing application, including soft-deleted
  applications.

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

## Job Applications

`job_applications` stores the user's current application pipeline. It is intentionally top-level in
the API and frontend, but it still validates links to owned companies and their contacts.

| Column            | Type          | Required | Notes                                                   |
| ----------------- | ------------- | -------- | ------------------------------------------------------- |
| `id`              | UUID          | Yes      | Primary key                                             |
| `user_id`         | UUID          | Yes      | FK to `users.id`; direct owner of the application       |
| `company_id`      | UUID          | Yes      | FK to `companies.id`; selected company                  |
| `contact_id`      | UUID          | No       | FK to `contacts.id`; set to null if hard-deleted        |
| `job_title`       | varchar(160)  | Yes      | Trimmed, non-empty                                      |
| `job_url`         | varchar(2048) | No       | Validated by the API as a URL                           |
| `source`          | varchar(120)  | No       | Application source, such as LinkedIn or referral        |
| `status`          | varchar(40)   | Yes      | Current status; defaults to `draft`; constrained values |
| `priority`        | varchar(20)   | Yes      | Defaults to `medium`; constrained to allowed priorities |
| `salary_min`      | integer       | No       | Must be non-negative                                    |
| `salary_max`      | integer       | No       | Must be non-negative and `>= salary_min` when both set  |
| `salary_currency` | char(3)       | No       | Required when salary is provided; uppercase ISO-like    |
| `location`        | varchar(160)  | No       | Optional filter field                                   |
| `employment_type` | varchar(80)   | No       | Optional filter field                                   |
| `work_mode`       | varchar(80)   | No       | Optional filter field                                   |
| `applied_at`      | date          | No       | Date-only value, not a timestamp                        |
| `notes`           | text          | No       | User notes                                              |
| `created_at`      | timestamp     | Yes      | Managed by Sequelize                                    |
| `updated_at`      | timestamp     | Yes      | Managed by Sequelize                                    |
| `deleted_at`      | timestamp     | No       | Set by Sequelize paranoid soft deletion                 |

Allowed status values:

```text
draft, applied, screening, interviewing, offer, rejected, withdrawn, accepted
```

Allowed priority values:

```text
low, medium, high
```

Important constraints and indexes:

- `job_applications_job_title_trimmed_not_empty_check` prevents whitespace-only titles.
- `job_applications_status_check` constrains status values.
- `job_applications_priority_check` constrains priority values.
- `job_applications_salary_non_negative_check` prevents negative salary values.
- `job_applications_salary_range_check` enforces `salary_min <= salary_max` when both are present.
- `job_applications_salary_currency_required_check` requires currency when salary is provided.
- `job_applications_salary_currency_format_check` requires uppercase 3-letter currency when set.
- `job_applications_user_id_idx` supports ownership-scoped queries.
- `job_applications_user_id_status_idx` supports status filtering.
- `job_applications_user_id_company_id_idx` supports company filtering.
- `job_applications_user_id_contact_id_idx` supports contact filtering.
- `job_applications_user_id_applied_at_idx` supports applied-date sorting and future reporting.
- `job_applications_user_id_updated_at_idx` supports default list sorting.
- `job_applications_user_id_job_title_idx` supports deterministic title sorting.

There is no duplicate-application uniqueness rule in Phase 3. Users may track multiple
applications with the same title and company because real hiring processes can contain repeated or
similar roles.

## Application Status History

`application_status_history` stores the append-only status timeline for job applications. It does
not store `user_id`; ownership is derived through the parent `job_applications` row.

| Column           | Type        | Required | Notes                                    |
| ---------------- | ----------- | -------- | ---------------------------------------- |
| `id`             | UUID        | Yes      | Primary key                              |
| `application_id` | UUID        | Yes      | FK to `job_applications.id`              |
| `from_status`    | varchar(40) | No       | Previous status; `null` for initial rows |
| `to_status`      | varchar(40) | Yes      | New/current status after the transition  |
| `changed_at`     | timestamp   | Yes      | Backend-generated transition time        |
| `note`           | text        | No       | Optional transition note                 |
| `created_at`     | timestamp   | Yes      | Managed by Sequelize                     |
| `updated_at`     | timestamp   | Yes      | Managed by Sequelize                     |

Important constraints and indexes:

- `application_status_history_from_status_check` allows `null` or one allowed application status.
- `application_status_history_to_status_check` constrains the target status to allowed values.
- `application_status_history_application_id_idx` supports parent lookups.
- `application_status_history_application_id_changed_at_idx` supports oldest-first timelines.
- The `application_id` foreign key uses physical `ON DELETE CASCADE`, so hard-deleting an
  application removes its history rows.

Migration `006-create-application-status-history` backfills one initial history row for every
existing application, including soft-deleted applications. Backfilled rows use `from_status = null`,
the application's current `status` as `to_status`, and the application's `created_at` as
`changed_at`, `created_at`, and `updated_at`.

Normal application soft deletion does not delete history rows. API access to history still requires
an active owned parent application, so soft-deleted application history is retained in the database
but hidden from normal users.

## Test Database Safety

Backend integration tests run with `NODE_ENV=test` and require a database name containing `test`.
The Vitest setup resolves the final `DATABASE_URL`, parses the database name, and refuses to run if
the name does not include `test`. This protects the development database from destructive cleanup
used in integration tests.

The default test database URL is:

```text
postgres://careerpilot:careerpilot_dev_password@localhost:5432/careerpilot_test
```
