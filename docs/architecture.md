# CareerPilot Architecture

CareerPilot is a modular monolith with an Angular frontend, an Express API, and PostgreSQL.

## Current Feature Modules

### Authentication

Authentication lives in the backend auth module and Angular core auth area. The frontend keeps the
access token in memory and relies on the refresh-token HTTP-only cookie for session restoration.

### Companies

Companies are the first business-domain aggregate. A company belongs directly to one authenticated
user and is the parent for contacts and job applications.

Backend company code lives in:

```text
apps/backend/src/modules/companies
```

Frontend company code lives in:

```text
apps/frontend/src/app/features/companies
```

The Angular feature follows a page/component/data-access split:

```text
features/companies/
  companies.routes.ts
  data-access/
  components/
  pages/
```

### Contacts

Contacts are nested under companies instead of being a global feature. This matches the domain: a
recruiter contact only makes sense in the context of the company where the user is applying.

Backend contact routes are mounted under:

```text
/api/v1/companies/:companyId/contacts
```

Frontend contact routes are nested under:

```text
/companies/:companyId/contacts
```

Contacts have their own Angular data-access store and API service. The company detail page embeds
the contact list, but company state and contact state stay separate.

### Job Applications

Job applications are the central pipeline resource. Each application belongs directly to one
authenticated user, requires one owned company, and can optionally reference one contact from that
company.

Phase 4 adds append-only application status history. `job_applications.status` remains the current
status for efficient list filtering and sorting, while `application_status_history` stores the
timeline. Status transitions update both records in one backend transaction.

Backend application code lives in:

```text
apps/backend/src/modules/applications
```

Application API routes are top-level:

```text
/api/v1/applications
```

Frontend application code lives in:

```text
apps/frontend/src/app/features/applications
```

The Angular feature follows the established feature folder structure:

```text
features/applications/
  applications.routes.ts
  data-access/
  components/
  pages/
```

Application frontend routes are:

```text
/applications
/applications/new
/applications/:applicationId
/applications/:applicationId/edit
```

The application detail page renders the status timeline and opens a status-transition dialog. The
create workflow still allows choosing an initial status. The edit workflow no longer edits status;
status changes go through the dedicated transition workflow.

### Interviews

Interviews belong to job applications. The backend module in
`apps/backend/src/modules/interviews` mounts a router under
`/api/v1/applications/:applicationId/interviews`, behind Applications authentication.
It verifies the parent application before querying or mutating interviews. Interview status is
independent of application status; interview writes do not create application history entries.

The Angular feature in `apps/frontend/src/app/features/interviews` has an API service, a
component-scoped signal store, and list, form, and delete-dialog components. The application detail
page embeds the list; there are no standalone interview routes. See
[ADR 0009](decisions/0009-interview-ownership.md).

### Tasks & Follow-ups

The backend module in `apps/backend/src/modules/tasks` provides a read-only cross-application
list at `/api/v1/tasks` and nested task routes under
`/api/v1/applications/:applicationId/tasks`. Every write uses the nested routes. Completion is
derived from `completed_at` and does not change the application's status or history.

The Angular feature in `apps/frontend/src/app/features/tasks` shares an API service, a
component-scoped signal/RxJS store, and list rendering between Application detail and the dedicated
`/tasks` page. Application detail owns create, edit, and delete dialogs. Both views can complete
or reopen tasks and reload the list after successful writes; they do not update optimistically.
The Tasks page supports server-side filtering, sorting, pagination, and parent navigation.
See [ADR 0010](decisions/0010-application-tasks.md).

### Dashboard & Analytics

The read-only Dashboard module exposes `GET /api/v1/dashboard`. One parameterized
PostgreSQL statement, run through Sequelize, defines a shared visible-application scope and
uses it for every aggregate and preview. The sections are read from the same database snapshot.
PostgreSQL fills missing statuses and months with zeros and bounds each preview to five rows.
There are no new tables, background jobs, or client-side scans of application records.

The authenticated Angular `/dashboard` page uses a feature API service and a component-scoped
signal/RxJS store. It sends the browser's local calendar date, renders the API's counts with
labeled CSS bars, and links preview items to Application detail. See
[ADR 0011](decisions/0011-dashboard-aggregation.md).

### Resume Management & Job Matching

- The Resumes module validates and extracts text before writing original bytes through
  `ResumeStorage`. PostgreSQL holds metadata, extracted text, and an opaque storage key;
  the filesystem is private and never served as a static directory.
- Resumes belong directly to users. Matching reuses the Applications module's active
  Application/Company scope before loading the owned, active Resume's text. Coverage is
  computed on demand; no comparison record or resume-to-application link is stored.
- The authenticated Angular `/resumes` page uses a scoped signal/RxJS store and an API service.
  Application forms edit the optional description; the detail panel loads owned resumes and
  renders comparison states without receiving extracted text.
- See [ADR 0012](decisions/0012-resume-storage-and-matching.md) for storage and scoring tradeoffs.

### Notifications & Reminders

- The backend runs one set-based PostgreSQL delivery statement at startup and every
  minute, skipping overlap in the same process. Event uniqueness makes retries and
  concurrent processes safe without a separate queue or in-memory delivery cursor.
- The inbox validates the live recipient, Application, Company, and source snapshot on
  reads and mark-as-read. Rows are retained for deduplication even when no longer visible.
- The authenticated Angular shell and `/notifications` share one signal/RxJS store. The
  bell requests a one-item unread page outside the center. The center requests its current
  page and filter; it refreshes on entry, tab visibility, manual refresh, and read completion.
  Background HTTP polling runs every minute while authenticated and visible.
- See [ADR 0013](decisions/0013-in-app-reminders.md).

## Ownership Model

The authenticated user ID is the security boundary for business data.

- `companies.user_id` stores direct ownership.
- `resumes.user_id` stores direct ownership independent of applications.
- `contacts.company_id` stores the parent relationship.
- Contact ownership is derived by verifying the parent company belongs to the authenticated user.
- `job_applications.user_id` stores direct ownership because applications are queried as a
  top-level pipeline resource.
- `application_status_history.application_id` stores the parent application relationship.
- Status-history ownership is derived through the parent application; history rows do not duplicate
  `user_id`.
- Application company ownership is verified before create/update operations.
- Application contacts are optional and must belong to the selected company.
- Backend services never fetch, update, or delete a company by ID alone.
- Contact services verify the owned parent company before reading or mutating a contact.
- Application services scope every list/detail/update/delete operation by authenticated user ID.
- Status-history list and transition operations first verify an active owned parent application.
- Interview operations require an active owned application with an active owned company. Updates
  and deletions also scope the interview lookup by the application ID.
- Task ownership is derived from the active owned application and its active owned company, even
  on the cross-application list. Nested item lookups also require the task's application ID.
- Cross-user access returns `404`, matching nonexistent resources, so resource existence is not
  revealed.

This model keeps ownership checks explicit while still matching the product model: companies are
owned records, contacts hang from companies, and applications are the user's pipeline entries.

## Soft Deletion

Companies, contacts, job applications, interviews, tasks, and resumes use Sequelize paranoid models with
`deleted_at`.

- Normal list/detail queries only return active records.
- Deleting a contact soft-deletes that contact.
- Deleting a company runs in one backend transaction and soft-deletes the company plus its active
  contacts.
- Deleting an application soft-deletes that application.
- Soft-deleting an application leaves its status history rows in the database.
- Normal status-history API access requires an active owned parent application, so soft-deleted
  application history is hidden from normal routes.
- Deleting an interview soft-deletes only the interview. Soft-deleting an application retains its
  interviews but hides them from the nested API.
- Hard-deleting an application physically cascades status history and interview rows.
- Deleting a task soft-deletes only that task. Soft-deleting the application or its company
  hides retained tasks from both task lists. Hard-deleting the application cascades task rows.
- Deleting a resume hides it from listing, download, and matching, but retains bytes and text.
- Company deletion does not yet soft-delete or otherwise modify applications; that behavior should
  be decided when application lifecycle rules are expanded.
- PostgreSQL foreign-key cascade is not used for ordinary soft deletion because no physical delete
  occurs.

Physical cascade rules remain useful only if records are hard-deleted by administrative or test
cleanup workflows.

## Frontend Workflows

### Appearance Foundation

See the [CareerPilot design system guide](design-system.md) for token usage, shared
record styles, theme behavior, and accessibility checks.

Angular Material 3 owns component styling, including overlays. Global CareerPilot
`--cp-*` tokens cover semantic colors, typography, spacing, radii, and shadows. Tailwind
CSS 4 maps shared tokens to utilities; Preflight is intentionally omitted. Keep existing
component SCSS where it is the clearer fit.

The document root sets the color scheme for the entire application. A small startup
script restores the appearance preference before styles render. System leaves both
schemes available so the browser responds to OS changes without a JavaScript listener.
Only the appearance preference is stored in `localStorage`; authentication is unchanged.
Rebuild the frontend image after updating its build dependencies:
`docker compose up -d --build frontend`.

The authenticated shell links to Applications alongside Companies. The Applications feature
supports:

- List: search, status and priority filters, source/location filters, sorting, pagination,
  loading, empty, and error states.
- Create: typed reactive form with company selector and optional contact selector.
- Detail: application summary, company link, optional contact display, salary formatting, notes,
  status timeline, change-status action, edit, and delete action.
- Status transition: dialog with target status and optional note; success refreshes current
  application state and appends the new timeline entry.
- Interviews: scheduled-time list with loading, empty, error, and retry states; schedule/edit
  dialog and delete confirmation. Times display in browser local time and are submitted as UTC
  timestamps. Successful writes refresh the list.
- Edit: loads the selected application and reuses the form component, excluding status editing.
- Delete: confirmation dialog and soft-delete API call.

The contact selector is loaded from the selected company. When the company changes, the form clears
the selected contact unless that contact still belongs to the new company.

## Testing Coverage

Backend integration coverage includes authentication requirements, create/update/delete, ownership
scoping, cross-user `404` behavior, company validation, contact/company mismatch, validation
failures, search, filters, sorting, pagination, company-name search/sort, soft deletion, initial
status-history creation, history listing, same-status transition rejection, and transactional
status transitions.

Frontend coverage includes the Applications API service, signal store, typed form validation and
normalization, company/contact selector behavior, list filters/sorting/pagination, create/edit
navigation workflows, detail rendering, delete-dialog wiring, status-history timeline states,
status-transition dialog validation/error handling, and status-free edit submissions.

Interview tests cover database constraints and deletion behavior, nested API authentication and
ownership, validation and partial updates, and frontend list refresh, retry, scheduling, and
deletion workflows.

Task coverage includes database constraints and deletion, nested ownership and completion, date
filters before pagination, and frontend workflows for failed writes, focus, retries, stale
requests, and local-calendar boundaries.

## Decisions

- Use a monorepo to keep frontend, backend, and shared contracts together.
- Use standalone Angular components so new features do not require NgModule ceremony.
- Use strict TypeScript everywhere so mistakes are caught before runtime.
- Use REST first because it is easy to document, test, and discuss in interviews.
- Use PostgreSQL as the source of truth for relational application data.
- Use Docker Compose for local infrastructure so every developer can run the same services.
- Use nested contacts rather than a global contacts feature until the product has a real
  cross-company contact workflow.
- Use top-level applications because users manage applications as their primary job-search
  pipeline.

## Alternatives Considered

- Separate repositories: clearer deployment boundaries, but more setup overhead for a learning portfolio.
- Nx/Turborepo: powerful monorepo tooling, but Phase 0 stays lighter with pnpm workspaces.
- GraphQL: useful for complex client-driven data fetching, but REST is simpler for this domain.
- Microservices: unnecessary until there is a real scaling or ownership reason.
