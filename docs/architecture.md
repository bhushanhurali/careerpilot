# CareerPilot Architecture

CareerPilot is a modular monolith with an Angular frontend, an Express API, and PostgreSQL.

## Decisions

- Use a monorepo to keep frontend, backend, and shared contracts together.
- Use standalone Angular components so new features do not require NgModule ceremony.
- Use strict TypeScript everywhere so mistakes are caught before runtime.
- Use REST first because it is easy to document, test, and discuss in interviews.
- Use PostgreSQL as the source of truth for relational application data.
- Use Docker Compose for local infrastructure so every developer can run the same services.

## Alternatives Considered

- Separate repositories: clearer deployment boundaries, but more setup overhead for a learning portfolio.
- Nx/Turborepo: powerful monorepo tooling, but Phase 0 stays lighter with pnpm workspaces.
- GraphQL: useful for complex client-driven data fetching, but REST is simpler for this domain.
- Microservices: unnecessary until there is a real scaling or ownership reason.
