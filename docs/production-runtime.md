# Production Docker Runtime

Use a dedicated Compose project on a Linux Docker host. This setup runs one API instance with its
reminder and resume-cleanup workers. It does not configure EC2, Cloudflare Pages, DNS, or EC2 access.

## Operator Configuration

Supply a protected environment file outside the repository (mode `0600`). Use the same project name
and file for every command. Do not publish rendered Compose configuration: it includes secrets.

| Setting                                             | Supply                                                                                                                                                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | PostgreSQL initialization settings. Changing them does not update an existing database volume.                                                                                                         |
| `DATABASE_URL`                                      | Explicit PostgreSQL URL pointing to service `postgres` and the intended database. Percent-encode credentials as needed.                                                                                |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`           | Distinct outputs from separate `openssl rand -hex 32` calls.                                                                                                                                           |
| `PROXY_SUBNET`, `TRUSTED_PROXY_IP`                  | An unused private subnet and an explicit usable IPv4 inside it, e.g. `172.29.231.0/24` and `172.29.231.10`. Check for overlap first. Compose assigns that same address to Caddy and Express trusts it. |
| `RESUME_HOST_DIR`, `RESUME_STORAGE_ID`              | Absolute persistent host directory and a stable UUID identifying that directory. Keep both stable across releases.                                                                                     |
| `LOG_LEVEL`, `REMINDER_TIME_ZONE`                   | Optional; default to `info` and `UTC`. The timezone applies deployment-wide.                                                                                                                           |

Compose sets the production CORS origin and secure cookies. PostgreSQL and the API do not publish
ports. Caddy is the only service publishing ports (`80`/`443`); the API/DB network and Caddy/API
network are separate. Runtime secrets are passed as environment variables, so Docker administrators
can inspect them. Restrict host and Docker access.

On the actual persistent filesystem, provision a dedicated resume directory owned by UID/GID
`1000:1000`, mode `0700`, with a regular `.storage-id` file owned by the same user, mode `0600`.
For a **new** directory only, for example:

```sh
sudo install -d -m 0700 -o 1000 -g 1000 /srv/jobthreader/resumes
printf '%s\n' "$RESUME_STORAGE_ID" | sudo install -m 0600 -o 1000 -g 1000 /dev/stdin /srv/jobthreader/resumes/.storage-id
```

Do not recreate or copy the marker to an empty directory to make startup pass. After host reboot,
mount the persistent disk before starting Compose. Startup verifies that the directory is a real mount,
matches the configured identity, and supports create/delete as the API user. Resume operations and
cleanup recheck identity, so a missing or mismatched mount does not clear pending cleanup. An operator
who restores a matching marker without its files can still cause data loss; restore both together.

## Run a Release

```sh
dc() { docker compose --project-name jobthreader --env-file /secure/jobthreader.env -f docker-compose.prod.yml "$@"; }
dc config --quiet
dc build backend
dc up -d --wait postgres
# For upgrades: stop the old API before schema changes and take a coordinated backup first.
dc stop backend
dc run --rm --no-deps backend node dist/db/migrate.js up
dc up -d --wait backend caddy
curl --fail https://api.jobthreader.com/ready
```

Run the compiled migration command once per release, not in each API process. A production ledger
contains `.js` migration names. The runner rejects unexpected names, including `.ts` rows from a
source-run database, before applying changes. For a legacy import, reconcile the ledger on an isolated
restore only after mapping each applied migration to its identical compiled counterpart and verifying
the schema; do not delete the ledger or blindly rerun migrations. Production readiness checks the
ledger and storage; it does not detect all out-of-band schema drift or replace a restore drill.

`/health` is liveness; `/ready` returns 503 when the schema/database or storage checks fail. Workers
start only after production startup checks pass. SIGTERM drains HTTP and current worker runs and
closes Sequelize, with a 20-second deadline (Compose allows 25 seconds). Compose health failure alone
does not restart a running container. Monitor health, disk, cleanup backlog, and backups separately.
Back up PostgreSQL and the private resume directory together, off host, and test recovery before
launch. Deleted files can remain in backups until expiration. Do not remove production volumes with
`down --volumes`.

## HTTPS and Forwarded Headers

Start with **DNS-only** for the API record. Caddy handles HTTPS for `api.jobthreader.com`; arrange
DNS and firewall access for certificate issuance and renewal. Caddy discards incoming forwarded
values by default for untrusted clients, and the Caddyfile also strips `Forwarded`,
`CF-Connecting-IP`, and `X-Real-IP`. Do not expose an alternate path to Express.

If you enable Cloudflare proxy mode, configure Full (strict) TLS and restrict origin ingress to
verified Cloudflare networks. Configure Caddy to trust only the official Cloudflare IP ranges and
derive a verified client IP (for example from `CF-Connecting-IP` at that trusted boundary), then
replace `X-Forwarded-For` with that **single** address before passing to Express. Maintain the ranges
and test header spoofing and separate rate-limit buckets. Do not simply enable proxy mode using the
default Caddyfile: the API will see Cloudflare edge IPs and share buckets. Express must continue to
trust only its static Caddy peer. See [Caddy proxy header handling](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#defaults).

## Local Smoke Test

Run `node docker/smoke-production.mjs` with a local Docker daemon and Compose v2. It builds the
production image, validates Caddy, and uses an isolated disposable project with no published ports.
It tests compiled migrations, startup gates, readiness, and storage across recreation. It does not
issue live TLS certificates, test Cloudflare, or touch existing volumes.
