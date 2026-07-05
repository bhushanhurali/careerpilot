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

## Ownership Model

The authenticated user ID is the security boundary for business data.

- `companies.user_id` stores direct ownership.
- `contacts.company_id` stores the parent relationship.
- Contact ownership is derived by verifying the parent company belongs to the authenticated user.
- Backend services never fetch, update, or delete a company by ID alone.
- Contact services verify the owned parent company before reading or mutating a contact.
- Cross-user access returns `404`, matching nonexistent resources, so resource existence is not
  revealed.

This model is intentionally simple for Phase 2 and prepares the project for job applications,
which can later reference an owned company and optionally related contacts.

## Soft Deletion

Companies and contacts use Sequelize paranoid models with `deleted_at`.

- Normal list/detail queries only return active records.
- Deleting a contact soft-deletes that contact.
- Deleting a company runs in one backend transaction and soft-deletes the company plus its active
  contacts.
- PostgreSQL foreign-key cascade is not used for ordinary soft deletion because no physical delete
  occurs.

Physical cascade rules remain useful only if records are hard-deleted by administrative or test
cleanup workflows.

## Decisions

- Use a monorepo to keep frontend, backend, and shared contracts together.
- Use standalone Angular components so new features do not require NgModule ceremony.
- Use strict TypeScript everywhere so mistakes are caught before runtime.
- Use REST first because it is easy to document, test, and discuss in interviews.
- Use PostgreSQL as the source of truth for relational application data.
- Use Docker Compose for local infrastructure so every developer can run the same services.
- Use nested contacts rather than a global contacts feature until the product has a real
  cross-company contact workflow.

## Alternatives Considered

- Separate repositories: clearer deployment boundaries, but more setup overhead for a learning portfolio.
- Nx/Turborepo: powerful monorepo tooling, but Phase 0 stays lighter with pnpm workspaces.
- GraphQL: useful for complex client-driven data fetching, but REST is simpler for this domain.
- Microservices: unnecessary until there is a real scaling or ownership reason.
