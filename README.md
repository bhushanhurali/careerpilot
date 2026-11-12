# CareerPilot

Modern full-stack job application tracking platform built with Angular 20, Node.js 22, PostgreSQL, Docker, and GitHub Actions.

Phase 7 Dashboard & Analytics is implemented. CareerPilot currently includes registration, login,
logout, refresh-token rotation, session restoration, protected company CRUD, nested contact
management, protected job application CRUD, append-only application status history, transactional
status transitions, interview scheduling, application tasks, an analytics dashboard, soft deletion, and
frontend/backend tests for the completed feature set.

## Architecture

```text
apps/frontend         Angular 20 standalone frontend
apps/backend          Node.js 22, Express, TypeScript API
docker                Development and production container definitions
docs                  Setup, API, security, architecture, and decision records
```

## Roadmap Status

| Phase   | Status   | Scope                                                                          |
| ------- | -------- | ------------------------------------------------------------------------------ |
| Phase 0 | Complete | Monorepo, tooling, Docker, CI foundation                                       |
| Phase 1 | Complete | Authentication, token flow, frontend auth foundation, auth tests, docs         |
| Phase 2 | Complete | Companies, nested contacts, ownership, soft deletion, frontend workflows, docs |
| Phase 3 | Complete | Job application model, API, frontend workflows, tests, docs                    |
| Phase 4 | Complete | Status history, transactional status transitions, frontend timeline, tests     |
| Phase 5 | Complete | Interview scheduling and management on application detail, API, tests, docs    |
| Phase 6 | Complete | Application tasks, due-date filters, and cross-application follow-ups          |
| Phase 7 | Complete | Dashboard KPIs, application trends, upcoming work, and recent activity         |

## Prerequisites

```text
Node.js 22.x
pnpm 10.x
Docker Desktop
Git
```

## Local Setup

For a detailed beginner-friendly setup guide, see [Local Development Setup](docs/local-development.md).

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm --filter @careerpilot/backend migrate:up
pnpm dev
```

Frontend:

```text
http://localhost:4200
```

Backend health check:

```text
http://localhost:3000/api/v1/health
```

## Useful Commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm typecheck
pnpm format:check
pnpm --filter @careerpilot/backend migrate:up
pnpm commit
```

## Database Commands

Start PostgreSQL before running database commands:

```bash
docker compose up -d postgres
```

```bash
pnpm --filter @careerpilot/backend migrate:up
pnpm --filter @careerpilot/backend migrate:down
pnpm --filter @careerpilot/backend seed
```

- `migrate:up` applies pending migrations.
- `migrate:down` rolls back the most recent migration.
- `seed` runs the development seed strategy.

## Authentication

CareerPilot uses short-lived JWT access tokens held only in frontend memory and rotating refresh
tokens delivered through HTTP-only cookies. PostgreSQL stores only refresh-token hashes.

Read these documents before changing authentication:

- [Authentication decision record](docs/decisions/0005-authentication-token-strategy.md)
- [Security notes](docs/security.md)
- [Authentication API](docs/api.md)
- [Environment variables](docs/environment.md)

The project intentionally does not store tokens in `localStorage` or `sessionStorage`.

## Companies and Contacts

Authenticated users can manage their own companies and the recruiter or hiring contacts linked to
each company. Contacts are intentionally nested under companies:

```text
/companies/:companyId/contacts/...
```

The backend enforces ownership on every company query by using the authenticated user ID. Contacts
inherit ownership through their parent company, so contact operations first verify the parent
company belongs to the current user. Cross-user access returns the same `404` shape as a missing
resource.

Read these documents before changing Phase 2 behavior:

- [Architecture](docs/architecture.md)
- [Database plan](docs/database.md)
- [API documentation](docs/api.md)
- [Company/contact ownership ADR](docs/decisions/0006-company-contact-ownership.md)

## Job Applications

Authenticated users can manage job applications linked to one owned company and, optionally, one
contact from that company. Applications keep the current status on the application row for fast
pipeline filtering and also record append-only status history entries for lifecycle auditing.
Applications use top-level routes because they are now the central pipeline resource:

```text
/applications
/applications/new
/applications/:applicationId
/applications/:applicationId/edit
```

The backend enforces ownership with `job_applications.user_id` and validates that the selected
company belongs to the current user. When a contact is supplied, it must belong to the selected
company. Status changes go through a dedicated transition endpoint that updates the current
application status and inserts a history row in one database transaction. Cross-user application
and status-history access returns `404`.

Read these documents before changing application behavior:

- [Architecture](docs/architecture.md)
- [Database plan](docs/database.md)
- [API documentation](docs/api.md)
- [Application ownership ADR](docs/decisions/0007-job-application-ownership.md)
- [Application status history ADR](docs/decisions/0008-application-status-history.md)

## Interviews

Open an application to view, schedule, edit, or delete its interviews. The detail page displays
scheduled times in the browser's local timezone. Interviews have no standalone page or top-level
API; their API is nested under `/api/v1/applications/:applicationId/interviews`. Interview status
is independent of application status.

See the [Interview API](docs/api.md#interview-conventions) and
[Interview ownership ADR](docs/decisions/0009-interview-ownership.md) for the contract and lifecycle.

## Tasks & Follow-ups

Open an application to create, edit, complete, reopen, or delete its tasks. The Tasks page lists
tasks across applications with filters, sorting, pagination, and links back to the parent
application. You can also complete and reopen tasks from that page.

Due dates are optional calendar dates. An open task is overdue after its due date in your
browser's local calendar. See the [Tasks API](docs/api.md#task-conventions) and
[Tasks ADR](docs/decisions/0010-application-tasks.md).

## Dashboard & Analytics

Open **Dashboard** in the authenticated navigation for pipeline counts, current status
distribution, six months of submissions, upcoming interviews, due and overdue tasks, and recent
application activity. Preview rows link back to their applications.

The backend aggregates metrics and returns bounded previews. The dashboard uses your browser's
local calendar for submissions and task due dates. See the [Dashboard API](docs/api.md#dashboard)
for exact metric definitions.

## Commit Convention

Use Conventional Commits:

```text
feat(auth): add login endpoint
fix(applications): correct status transition validation
refactor(database): improve repository structure
test(auth): add refresh token tests
docs(readme): update setup guide
```

Use `pnpm commit` to create commits interactively with Commitizen.
