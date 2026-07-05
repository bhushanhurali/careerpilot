# CareerPilot Architecture

CareerPilot is a modular monolith with an Angular frontend, an Express API, and PostgreSQL.

## Current Feature Modules

### Authentication

Authentication lives in the backend auth module and Angular core auth area. The frontend keeps the
access token in memory and relies on the refresh-token HTTP-only cookie for session restoration.

### Companies

Companies are the first business-domain aggregate. A company belongs directly to one authenticated
user and is the parent for contacts and future job applications.

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

Job applications are the central Phase 3 pipeline resource. Each application belongs directly to
one authenticated user, requires one owned company, and can optionally reference one contact from
that company.

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

## Ownership Model

The authenticated user ID is the security boundary for business data.

- `companies.user_id` stores direct ownership.
- `contacts.company_id` stores the parent relationship.
- Contact ownership is derived by verifying the parent company belongs to the authenticated user.
- `job_applications.user_id` stores direct ownership because applications are queried as a
  top-level pipeline resource.
- Application company ownership is verified before create/update operations.
- Application contacts are optional and must belong to the selected company.
- Backend services never fetch, update, or delete a company by ID alone.
- Contact services verify the owned parent company before reading or mutating a contact.
- Application services scope every list/detail/update/delete operation by authenticated user ID.
- Cross-user access returns `404`, matching nonexistent resources, so resource existence is not
  revealed.

This model keeps ownership checks explicit while still matching the product model: companies are
owned records, contacts hang from companies, and applications are the user's pipeline entries.

## Soft Deletion

Companies and contacts use Sequelize paranoid models with `deleted_at`.

- Normal list/detail queries only return active records.
- Deleting a contact soft-deletes that contact.
- Deleting a company runs in one backend transaction and soft-deletes the company plus its active
  contacts.
- Deleting an application soft-deletes that application.
- Company deletion does not yet soft-delete or otherwise modify applications; that behavior should
  be decided when application lifecycle rules are expanded.
- PostgreSQL foreign-key cascade is not used for ordinary soft deletion because no physical delete
  occurs.

Physical cascade rules remain useful only if records are hard-deleted by administrative or test
cleanup workflows.

## Frontend Workflows

The authenticated shell links to Applications alongside Companies. The Applications feature
supports:

- List: search, status and priority filters, source/location filters, sorting, pagination,
  loading, empty, and error states.
- Create: typed reactive form with company selector and optional contact selector.
- Detail: application summary, company link, optional contact display, salary formatting, notes,
  edit, and delete action.
- Edit: loads the selected application and reuses the form component.
- Delete: confirmation dialog and soft-delete API call.

The contact selector is loaded from the selected company. When the company changes, the form clears
the selected contact unless that contact still belongs to the new company.

## Testing Coverage

Phase 3 has backend integration coverage for authentication requirements, create/update/delete,
ownership scoping, cross-user `404` behavior, company validation, contact/company mismatch,
validation failures, search, filters, sorting, pagination, company-name search/sort, and soft
deletion.

Frontend coverage includes the Applications API service, signal store, typed form validation and
normalization, company/contact selector behavior, list filters/sorting/pagination, create/edit
navigation workflows, detail rendering, and delete-dialog wiring.

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
