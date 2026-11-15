# Manual Deployment Runbook

JobThreader uses Cloudflare Pages at `https://jobthreader.com` and one Express container on EC2 at
`https://api.jobthreader.com`. Caddy terminates HTTPS. PostgreSQL and the API have no published
ports. The database and original resume files persist separately. This guide is for the operator;
no AWS or Cloudflare resources are configured by the repository.

## 1. Verify AWS Eligibility and Costs

1. In Billing and Cost Management, check the account plan, remaining credits, expiration dates,
   eligible services, and current charges. Confirm the selected Region, Linux AMI, architecture,
   instance type, and EBS configuration are eligible **for this account**. Do not rely on an earlier
   estimate of remaining trial time.
2. Estimate compute, public IPv4, EBS, snapshots, outbound traffic, backups, and monitoring for the
   planned Region, including the cost after credits expire. Configure budget and forecast alerts;
   alerts do not constitute a spending cap. Decide what to stop, retain, or delete if costs rise.
3. Enable MFA and use a least-privilege administrative identity. Record the maintenance owner and
   incident contact before launch. See [AWS Free Tier guidance](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/tracking-free-tier-usage.html).

## 2. Prepare EC2 and Docker

1. Choose a supported, patched Linux AMI and enough CPU, memory, and disk for image builds, the API,
   PostgreSQL, and logs. Verify the image build on the chosen architecture. Arrange a stable
   public address and verify routing. Do not publish an AAAA record without working IPv6.
2. Allow inbound TCP `80` and `443` for Caddy and certificate issuance. Restrict SSH to the operator's
   trusted IP or use an approved private management path instead. Do not open `3000`, `5432`, or the
   Docker API. Confirm the host and security group expose only the intended services. Allow the
   outbound DNS, registry, update, ACME, and backup traffic the host needs.
3. Install Git, OpenSSL, curl, and [Docker Engine](https://docs.docker.com/engine/install/) with the
   Compose v2 and Buildx plugins. Check `docker version`, `docker compose version`, and
   `docker buildx version`. Docker daemon access is effectively host-admin access; restrict it.
4. Plan encrypted persistent disk capacity. Check which filesystem backs Docker's data root
   (PostgreSQL and Caddy named volumes) and the separate resume directory. Confirm mount-on-boot and
   EC2 volume deletion settings. Verify the intended disks are mounted before starting the stack.

## 3. Check Out and Configure a Release

```sh
git clone https://github.com/bhushanhurali/jobthreader.git
cd jobthreader
git checkout --detach 'REPLACE_WITH_REVIEWED_RELEASE_COMMIT'
git rev-parse HEAD
```

Create a private directory and a `0600` environment file outside the checkout. See the
[runtime configuration table](production-runtime.md#operator-configuration) for every variable.
Generate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` with separate `openssl rand -hex 32` calls;
generate an independent PostgreSQL password. Capture outputs privately, not in chat, shell history,
build settings, or Git. Use a stable UUID for `RESUME_STORAGE_ID`. Set `DATABASE_URL` to the
`postgres` service name and the intended database. The bootstrap role in the example Compose setup
is privileged; using separate migration and runtime roles requires explicit provisioning and
permission testing. Do not share rendered Compose output or raw container inspection output.

Choose a non-overlapping `PROXY_SUBNET` and a usable static `TRUSTED_PROXY_IP` inside it. Compose
assigns that address to Caddy and passes the same address to Express. Do not attach unrelated
containers to that network or create a direct path to Express. As described in the
[runtime proxy guide](production-runtime.md#https-and-forwarded-headers), Caddy discards spoofable
forwarding headers from untrusted clients. Do not enable Cloudflare proxy mode for `api` until its
origin restrictions and verified client-IP handling are designed and tested.

Create the new [private resume mount and `.storage-id` marker](production-runtime.md#operator-configuration)
on the intended disk, owned by UID/GID `1000:1000`. Confirm the directory is mode `0700`, the marker
is mode `0600`, and `findmnt -T` shows the expected backing filesystem. Do not use a temporary or
empty replacement directory if the real disk is unavailable. Docker initializes the named
PostgreSQL volume on first start; do not copy the local development database or its `.ts` ledger
into production without a verified migration plan.

## 4. Bring Up the Backend and HTTPS

Before publishing an API DNS record, explicitly set `REGISTRATION_ENABLED=false` in the protected
production environment file and follow the [restricted rollout](#7-restricted-rollout-and-privacy).

1. Follow [Run a Release](production-runtime.md#run-a-release): validate Compose quietly, build the
   image, start PostgreSQL and wait for health, run `node dist/db/migrate.js up` through the one-off
   backend container, then start the backend and Caddy. Do not start multiple migration commands.
2. In Cloudflare DNS, point `api.jobthreader.com` at the stable EC2 IPv4 address using a **DNS-only**
   A record. Confirm resolution from outside EC2 and let Caddy obtain its certificate. Keep Caddy's
   `/data` and `/config` volumes across recreations. Confirm HTTP redirects to HTTPS and the
   certificate is valid for the hostname; do not accept an insecure TLS workaround.
3. Check `dc ps`, `dc logs --tail=100 backend postgres caddy`, and
   `curl --fail https://api.jobthreader.com/ready` from an authorized client. `/health` is liveness,
   not readiness. A `503` or failed Caddy upstream check is a stop signal, not a reason to bypass
   readiness.

### Provision the Initial Account

Keep `REGISTRATION_ENABLED=false` throughout. After PostgreSQL is healthy and compiled migrations
have run, create an ordinary account over a trusted operator SSH session. The one-off container
does not start an HTTP listener, publish ports, or create a session. Use a unique password from a
password manager (12 to 128 characters). In Bash, with the `dc` helper already defined:

```bash
(
  set +x
  set -o pipefail
  read -r -s -p 'Initial account password: ' account_password || exit 1
  printf '\n' >&2
  printf '%s' "$account_password" | dc run --rm --no-deps -T backend \
    node dist/modules/auth/create-account.js 'owner@example.com' 'First' 'Last'
)
```

Replace the example account details. Pass only the password on stdin, never as an argument,
Compose variable, or checked-in seed. A duplicate email fails without changing the existing
account. Confirm the policy endpoint reports `false`, and run this non-mutating probe:

```sh
curl -isS https://api.jobthreader.com/api/v1/auth/registration
curl -isS https://api.jobthreader.com/api/v1/auth/register \
  -H 'Origin: https://jobthreader.com' -H 'Content-Type: application/json' --data '{}'
```

Expect `200` with `registrationEnabled: false` and `403 REGISTRATION_DISABLED` respectively. Verify
the account can sign in normally and both registration URLs lead to sign-in without showing a form.

## 5. Configure Cloudflare Pages

| Setting           | Value                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Git repository    | `bhushanhurali/jobthreader`; choose the reviewed production branch when it contains these changes          |
| Root directory    | Repository root (leave blank in the dashboard)                                                             |
| Build environment | `NODE_VERSION=22`, `PNPM_VERSION=10.12.1`, `SKIP_DEPENDENCY_INSTALL=1`, `HUSKY=0`                          |
| Build command     | `pnpm install --frozen-lockfile && pnpm --filter @careerpilot/frontend build`                              |
| Output directory  | `apps/frontend/dist/frontend/browser`                                                                      |
| Custom domain     | `jobthreader.com`, attached in Pages under Custom domains, with the apex zone using Cloudflare nameservers |

Confirm the tool versions in the build log. The package build verifies that the bundle contains
`https://api.jobthreader.com/api/v1`. This URL is compiled in; no Pages API URL variable or backend
secret belongs in Pages. Change the Angular production config and verifier, then rebuild to change
it. Keep the publish root free of a top-level `404.html` so Pages serves the Angular entry point
for [SPA deep links](https://developers.cloudflare.com/pages/configuration/serving-pages/#single-page-application-spa-rendering).
Use default Pages caching unless there is a tested reason to change it. Do not cache private API
responses. See [Pages build settings](https://developers.cloudflare.com/pages/configuration/build-image/)
and [custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/).

## 6. Verify the Live Release

1. From another network, verify DNS, HTTPS, redirects, and that ports `3000` and `5432` are not
   reachable. Verify the Pages production build log and open or reload `/login`, `/register`, and
   `/dashboard` directly; signed-out protected routes should redirect to login.
2. At `https://jobthreader.com`, use an approved synthetic test account. Check login, page reload
   (refresh), logout, and a protected API request. In DevTools confirm exact credentialed CORS,
   `Cache-Control: private, no-store`, and a host-only `Secure`, `HttpOnly`, `SameSite=Lax` refresh
   cookie scoped to `/api/v1/auth`. Do not export cookies, tokens, or sensitive HAR files. A
   `pages.dev` preview does not test the same origin or cookie conditions.
3. Check the login preflight from the production origin and then repeat with an unapproved origin.
   The second request must not receive an allow-origin header. A production auth POST from the wrong
   origin must be rejected even with a valid request body. From two controlled client IPs, verify
   separate login rate-limit buckets and that injecting forwarded headers does not change the
   bucket. Do this before inviting users; limits are per process and reset on restart.

   ```sh
   curl -isS -X OPTIONS https://api.jobthreader.com/api/v1/auth/login \
     -H 'Origin: https://jobthreader.com' -H 'Access-Control-Request-Method: POST' \
     -H 'Access-Control-Request-Headers: content-type'
   ```

4. Upload and download a synthetic PDF/DOCX, check ownership isolation, recreate the backend and
   download again, then delete it. Verify immediate API access revocation, file removal, and
   cleanup backlog returning to normal. Check an in-app reminder using the configured timezone.
5. Complete an [isolated restore drill and alert checks](backup-and-recovery.md) and record outcomes
   against the deployed commit. The local Docker smoke command is not a substitute for these checks.

## 7. Restricted Rollout and Privacy

- **Keep public signup disabled** until these gates are met. Set `REGISTRATION_ENABLED=false` and
  verify direct API requests are rejected; hiding a button, CORS, and rate limiting do not disable
  signup. Provision any initial users privately. Keep test data synthetic until data-handling
  controls are in place.
- Publish a privacy notice identifying the operator and contact, data collected (including resumes,
  extracted text, job records, cookies and logs), purposes and applicable legal bases, processors,
  hosting and transfers, retention, rights, and request procedures. Review actual provider terms
  and data-processing agreements. For EU obligations, see [GDPR Articles 13 and 17](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng).
- Review whether a German **Impressum** applies to the actual operator and service. If required,
  publish accurate operator and contact information through an easily reachable public link. Review
  [§ 5 DDG](https://www.gesetze-im-internet.de/ddg/__5.html) and get jurisdiction-specific advice
  before launch. Also decide whether and how to publish service terms covering permitted use,
  uploaded content, availability, suspension, termination, and applicable consumer obligations.
  The repository copyright notice is not SaaS Terms of Service.
- Provide a verified contact process for access, export, and deletion requests. The app has no
  self-service account deletion, export, or operator purge workflow. Before public signup, document
  and rehearse identity verification, disabling login and refresh, purging owned records and resume
  data, and verifying cleanup without exposing personal details. Existing bearer tokens may remain
  usable until expiry: disabling an account or revoking refresh tokens does not invalidate every
  issued access token immediately. Do not delete the user row directly; resume ownership restricts
  that delete and database deletion alone does not remove files. Define operational retention and
  deletion deadlines, including logs and backups, and reconcile completed deletion requests before
  restoring service from older backups.

## Restarts, Upgrades, and Troubleshooting

- Restart with `dc restart backend` only when the image, configuration, and mounts are unchanged.
  Apply environment or image changes with `dc up -d --wait backend` after the required checks.
  Verify `/ready`, storage, and worker logs after restarts. Never use `down --volumes` in production.
- Before an upgrade, record the deployed commit and image IDs, review migrations, schedule downtime,
  stop the old backend, and take a coordinated backup. Build the reviewed release, run the explicit
  migration once, start the new stack, and repeat live checks. Coordinate Pages releases with API
  compatibility; GitHub Actions currently runs quality checks, not deployment.
- With no schema change, redeploy the previous known-good image/revision and matching Pages build
  only if still compatible with the live schema and configuration. After a schema change, prefer a
  tested forward fix or restore the matched pre-upgrade pair in isolation first. The compiled runner
  has no production `down` path. Restoring loses writes since the backup; preserve a secured copy of
  the failed state and obtain approval before cutover.
- For TLS errors, check DNS, port reachability, conflicting listeners, Caddy logs, and certificate
  volume permissions. For auth errors, check exact origin, cookie attributes, and both HTTPS
  hostnames. For startup or readiness errors, check PostgreSQL health and credentials, compiled
  ledger state, resume disk identity and permissions, and disk space. Never fabricate a mount marker
  or delete migration ledger rows to clear an error.

## Verification Coverage and Gaps

`node docker/smoke-production.mjs` was verified locally with production image packaging, disposable
PostgreSQL, compiled migrations, Caddy configuration validation, startup and readiness failures, and
resume persistence across recreation. CI runs format, lint, type checks, tests, builds, and **dev**
Compose validation; it does not run the production smoke check or deploy. No live EC2, ACME, Pages,
browser auth, or off-host restore has been verified by that smoke test. The commands and browser
checks above cover the initial manual deployment; a post-deploy synthetic monitor and automated
restore drill can be considered later once the operator has chosen tooling and retention policies.
