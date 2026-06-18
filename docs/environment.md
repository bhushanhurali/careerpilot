# Environment Variables

CareerPilot keeps local configuration in one `.env` file at the repository root. Copy
`.env.example` to `.env`; never commit the resulting file.

The backend loads the root file through `dotenv` before validating values with Zod. This applies to
development, production start commands, migrations, and direct backend commands. Backend tests set
isolated defaults in their Vitest setup rather than depending on a developer's `.env`.

Docker Compose reads the same root `.env` for variable substitution and passes the relevant values
into each service.

## Application Runtime

| Variable    | Required | Default       | Purpose                                       |
| ----------- | -------- | ------------- | --------------------------------------------- |
| `NODE_ENV`  | No       | `development` | Selects development, test, or production mode |
| `LOG_LEVEL` | No       | `info`        | Pino log level                                |

Allowed `NODE_ENV` values are `development`, `test`, and `production`. Allowed log levels are
`fatal`, `error`, `warn`, `info`, `debug`, and `trace`.

## PostgreSQL

| Variable            | Required                 | Example                                                                      | Purpose                                      |
| ------------------- | ------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------- |
| `DATABASE_URL`      | Yes for backend commands | `postgres://careerpilot:careerpilot_dev_password@localhost:5432/careerpilot` | Sequelize connection URL                     |
| `POSTGRES_HOST`     | No                       | `localhost`                                                                  | Local reference; Compose uses service DNS    |
| `POSTGRES_PORT`     | No                       | `5432`                                                                       | Host port mapped to the container            |
| `POSTGRES_DB`       | No                       | `careerpilot`                                                                | Database created when the volume initializes |
| `POSTGRES_USER`     | No                       | `careerpilot`                                                                | Initial PostgreSQL user                      |
| `POSTGRES_PASSWORD` | No                       | `careerpilot_dev_password`                                                   | Initial PostgreSQL password                  |

Host-run commands connect to `localhost`. Inside Docker, Compose constructs `DATABASE_URL` with
host `postgres`, which is the Compose service name.

`POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` initialize a new PostgreSQL data volume.
Changing them later does not rewrite an existing database.

## Authentication

| Variable                    | Required | Local example                                     | Purpose                           |
| --------------------------- | -------- | ------------------------------------------------- | --------------------------------- |
| `JWT_ACCESS_SECRET`         | Yes      | Random string of at least 32 characters           | Signs and verifies access JWTs    |
| `JWT_REFRESH_SECRET`        | Yes      | Different random string of at least 32 characters | Signs and verifies refresh JWTs   |
| `ACCESS_TOKEN_TTL_SECONDS`  | No       | `900`                                             | Access-token lifetime             |
| `REFRESH_TOKEN_TTL_SECONDS` | No       | `2592000`                                         | Refresh-token and cookie lifetime |
| `COOKIE_SECURE`             | No       | `false`                                           | Requires HTTPS for refresh cookie |

Use independent secrets so compromise or rotation of one token type does not automatically affect
the other. Example values are development placeholders, not production secrets.

`COOKIE_SECURE=false` is necessary for local HTTP. Production must use HTTPS and set it to `true`.
The backend also defaults the cookie to secure when `NODE_ENV=production` unless the variable
explicitly overrides that behavior.

## CORS

| Variable              | Required | Default/Example         | Purpose                         |
| --------------------- | -------- | ----------------------- | ------------------------------- |
| `BACKEND_CORS_ORIGIN` | No       | `http://localhost:4200` | Allowed credentialed web origin |
| `CORS_ORIGIN`         | No       | `http://localhost:4200` | Backend-native alias            |

`CORS_ORIGIN` takes precedence when both are set. Docker Compose and `.env.example` use
`BACKEND_CORS_ORIGIN` to make its ownership clear.

This value is one origin, not a comma-separated allowlist. It must exactly match the browser
frontend origin, including scheme and port. Credentialed CORS is enabled because refresh cookies
must cross the frontend/backend origin boundary during local development.

## Ports and Frontend API URL

| Variable              | Required | Default/Example                | Purpose                             |
| --------------------- | -------- | ------------------------------ | ----------------------------------- |
| `BACKEND_PORT`        | No       | `3000`                         | Backend host port and backend alias |
| `PORT`                | No       | `3000`                         | Backend-native listener variable    |
| `FRONTEND_PORT`       | No       | `4200`                         | Angular host port in Docker Compose |
| `NG_APP_API_BASE_URL` | No       | `http://localhost:3000/api/v1` | Browser-visible API base URL        |

`PORT` takes precedence over `BACKEND_PORT`. Docker Compose exposes `BACKEND_PORT` on the host but
runs the backend on container port `3000`.

`NG_APP_API_BASE_URL` must be reachable by the browser. Do not use Docker service name `backend`
here because the browser is outside the Compose network.

## Production Guidance

- Inject secrets through the deployment platform rather than committing an environment file.
- Use long, random, independently rotated JWT secrets.
- Set `NODE_ENV=production` and `COOKIE_SECURE=true`.
- Use PostgreSQL credentials with least privilege and TLS where supported.
- Set the exact deployed frontend origin for CORS.
- Treat a change to token TTLs as a security and user-experience decision.
- Never log environment values containing passwords or secrets.
