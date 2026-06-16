# CareerPilot

Modern full-stack job application tracking platform built with Angular 20, Node.js 22, PostgreSQL, Docker, and GitHub Actions.

Phase 0 contains the technical foundation only. Authentication, database models, and business features start in later phases.

## Architecture

```text
apps/frontend         Angular 20 standalone frontend
apps/backend          Node.js 22, Express, TypeScript API
docker                Development and production container definitions
docs                  Architecture notes and technical decisions
```

## Prerequisites

```text
Node.js 22.x
pnpm 10.x
Docker Desktop
Git
```

## Local Setup

```bash
pnpm install
cp .env.example .env
docker compose up --build
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
pnpm cz
```

## Commit Convention

Use Conventional Commits:

```text
feat(auth): add login endpoint
fix(applications): correct status transition validation
refactor(database): improve repository structure
test(auth): add refresh token tests
docs(readme): update setup guide
```

Use `pnpm commit` or `pnpm cz` to create commits interactively.
