# Local Development Setup

This guide walks you through setting up CareerPilot on your local machine.

CareerPilot uses:

- Angular 20 for the frontend
- Node.js 22 for the backend
- PostgreSQL in Docker
- pnpm for package management
- Git and GitHub for version control

## 1. Required Software

Install these tools before running the project:

| Tool           | Required Version      | Purpose                              |
| -------------- | --------------------- | ------------------------------------ |
| Node.js        | 22.x or newer         | Runs frontend/backend tooling        |
| pnpm           | 10.x or newer         | Installs and runs workspace packages |
| Docker Desktop | Recent stable version | Runs PostgreSQL and local containers |
| Git            | Recent stable version | Version control                      |
| GitHub Desktop | Optional              | Visual Git workflow                  |
| GitHub CLI     | Recent stable version | GitHub auth, PRs, and repo commands  |
| VS Code        | Recent stable version | Recommended editor                   |

The project is tested against Node.js 22 in CI and Docker. Newer Node versions may work locally, but Node.js 22 is the safest match.

## 2. Recommended VS Code Extensions

Install these extensions:

| Extension                 | Why                                                    |
| ------------------------- | ------------------------------------------------------ |
| Angular Language Service  | Angular template IntelliSense and diagnostics          |
| ESLint                    | Shows lint errors in the editor                        |
| Prettier - Code formatter | Formats code consistently                              |
| Docker                    | Helps inspect containers, images, and Compose services |
| GitHub Pull Requests      | Review and manage PRs from VS Code                     |
| PostgreSQL                | Connect to and inspect the local database              |
| EditorConfig for VS Code  | Applies `.editorconfig` settings                       |

Recommended VS Code settings:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

## 3. Node.js Setup

CareerPilot targets Node.js 22.

Check your version:

```bash
node --version
```

Expected:

```text
v22.x.x
```

If you use a Node version manager, select Node 22 when working in this repository. The repository includes:

```text
.node-version
```

That file tells compatible version managers which Node version to use.

## 4. pnpm Setup

CareerPilot uses pnpm workspaces.

Check whether pnpm is installed:

```bash
pnpm --version
```

Expected:

```text
10.x or newer
```

If pnpm is missing, enable it through Corepack:

```bash
corepack enable
corepack prepare pnpm@10.12.1 --activate
```

Install project dependencies:

```bash
pnpm install
```

Why pnpm?

- It works well for monorepos.
- It is fast.
- It avoids unnecessary dependency duplication.
- It supports workspace-level commands.

## 5. Git Setup

Check Git:

```bash
git --version
```

Configure your identity if needed:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

CareerPilot uses Conventional Commits. Use Commitizen instead of manually writing commit messages:

```bash
pnpm commit
```

or:

```bash
pnpm cz
```

Example commit:

```text
chore(workspace): configure monorepo tooling
```

## 6. GitHub CLI Setup

GitHub CLI is optional, but useful for authentication, pushing branches, and creating pull requests.

Check whether it is installed:

```bash
gh --version
```

Log in:

```bash
gh auth login
```

Recommended choices:

```text
GitHub.com
HTTPS
Login with a web browser
```

Check authentication:

```bash
gh auth status
```

Create a pull request later with:

```bash
gh pr create
```

You can also use GitHub Desktop instead of GitHub CLI. For this project, either workflow is fine.

## 7. Docker Setup

Install Docker Desktop and make sure it is running.

Check Docker:

```bash
docker --version
docker compose version
```

Validate the Compose file:

```bash
docker compose config
```

Start the local infrastructure and apps:

```bash
docker compose up --build
```

Stop containers:

```bash
docker compose down
```

Stop containers and remove local PostgreSQL data:

```bash
docker compose down -v
```

Use `-v` carefully. It deletes the local database volume.

## 8. PostgreSQL Setup

PostgreSQL runs through Docker Compose. You do not need to install PostgreSQL directly on your machine.

The database service is defined in:

```text
docker-compose.yml
```

Default local values:

```text
Database: careerpilot
User: careerpilot
Password: careerpilot_dev_password
Port: 5432
```

Connection string:

```text
postgres://careerpilot:careerpilot_dev_password@localhost:5432/careerpilot
```

Start only PostgreSQL:

```bash
docker compose up postgres
```

Later phases will add migrations. Phase 0 only creates the migration folder.

## 9. Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Do not commit `.env`.

The repository commits `.env.example` so every developer knows which variables are required.

## 10. Running CareerPilot

Install dependencies:

```bash
pnpm install
```

Run frontend and backend locally:

```bash
pnpm dev
```

Or run the full Docker setup:

```bash
docker compose up --build
```

Open the frontend:

```text
http://localhost:4200
```

Check the backend:

```text
http://localhost:3000/api/v1/health
```

Expected API response:

```json
{
  "success": true,
  "data": {
    "status": "ok"
  },
  "error": null,
  "meta": {}
}
```

## 11. Quality Commands

Run these before opening a pull request:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
docker compose config
```

What they do:

| Command                 | Purpose                                |
| ----------------------- | -------------------------------------- |
| `pnpm format:check`     | Verifies Prettier formatting           |
| `pnpm lint`             | Runs ESLint for frontend and backend   |
| `pnpm typecheck`        | Runs strict TypeScript checks          |
| `pnpm test`             | Runs frontend and backend tests        |
| `pnpm build`            | Builds frontend and backend            |
| `docker compose config` | Validates Docker Compose configuration |

## 12. Troubleshooting

If `pnpm` is missing:

```bash
corepack enable
corepack prepare pnpm@10.12.1 --activate
```

If Docker commands fail:

- Open Docker Desktop.
- Wait until Docker says it is running.
- Retry `docker compose config`.

If port `5432` is already in use:

- Stop your local PostgreSQL service, or
- Change `POSTGRES_PORT` in `.env`.

If frontend tests fail because Chrome cannot start:

- Make sure Google Chrome is installed.
- Retry `pnpm test`.
- The project uses a `ChromeHeadlessNoGpu` Karma launcher to avoid common Windows/CI GPU issues.

If Git hooks do not run:

```bash
pnpm install
```

Husky hooks are installed through the root `prepare` script.
