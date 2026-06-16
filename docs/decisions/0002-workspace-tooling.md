# 0002: Use pnpm Workspaces

## Decision

CareerPilot will use pnpm workspaces.

## Why

pnpm workspaces are lightweight, fast, and enough for this project. They avoid adding a larger monorepo framework before the project needs one.

## Alternatives

- Nx: excellent for large Angular monorepos, dependency graphs, and affected builds.
- Turborepo: strong task orchestration, especially for frontend-heavy repositories.
- npm workspaces: simpler, but pnpm has better disk usage and workspace ergonomics.

## Build Script Approval

pnpm stores approved dependency build scripts in `pnpm-workspace.yaml` under `allowBuilds`.

CareerPilot allows only the packages required by the Angular toolchain and related native helpers:

- `@parcel/watcher`
- `esbuild`
- `lmdb`
- `msgpackr-extract`

This keeps install-time scripts explicit instead of allowing every dependency to run arbitrary build scripts.
