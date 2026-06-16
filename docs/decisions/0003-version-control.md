# 0003: Enforce Conventional Commits

## Decision

CareerPilot will use Conventional Commits with Commitizen, Commitlint, Husky, and lint-staged.

## Why

Structured commits make history readable and prepare the repository for automated changelogs and semantic releases.

## Alternatives

- Manual commit discipline: simpler, but inconsistent across contributors.
- Squash-only history: keeps main clean, but still benefits from conventional PR titles or commits.
