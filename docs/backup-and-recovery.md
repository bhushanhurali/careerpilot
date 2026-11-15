# Backup, Recovery, and Monitoring

Use the [production Compose command helper](production-runtime.md#run-a-release) throughout. Choose
backup frequency, off-host location, retention, recovery point (maximum acceptable lost writes),
and recovery time (maximum tolerable outage) before accepting real data. This repository does not
schedule backups, ship alerts, or configure a recovery service.

## Coordinated Backup

PostgreSQL stores metadata, extracted resume text, and pending cleanup state. The private directory
stores the original files and the identity marker. Backing up one without the other is insufficient.

1. Record the deployed Git revision, backend image ID, PostgreSQL major version, backup time, and
   storage identity. Keep configuration and secrets in a separate protected recovery store. Retain
   Caddy state separately or plan for certificate reissuance.
2. Schedule a short outage and stop the backend (`dc stop backend`). Confirm it drained and is
   stopped, including both workers. Pause any manual writes or migrations too. Keep PostgreSQL up.
3. On Linux, set `BACKUP_DIR` to a **new** directory in a protected encrypted staging location and
   `RESUME_HOST_DIR` to the verified production resume directory. Keep the staging directory outside
   the resume tree. Run these commands and resolve any failure before labeling the pair complete:

   ```sh
   umask 077
   mkdir -- "$BACKUP_DIR"
   dc exec -T postgres sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
     > "$BACKUP_DIR/postgres.dump"
   sudo tar -C "$RESUME_HOST_DIR" -cpf - . > "$BACKUP_DIR/resumes.tar"
   (cd "$BACKUP_DIR" && sha256sum postgres.dump resumes.tar > SHA256SUMS)
   ```

   Check each command's exit status. The archive includes hidden `.storage-id` and file modes.
   `pg_dump` does not capture cluster-wide roles; record and recreate any separately provisioned
   roles and grants. Keep the Compose project name and volume mapping in the operator's inventory.

4. Start the backend again with `dc up -d --wait backend`, then verify `/ready`. Transfer the matched
   pair and its manifest to encrypted off-host storage with restricted access. Verify checksums on
   retrieval and timestamp only a completed transfer as a successful backup. Remove staging copies
   according to policy. A copy on EC2 alone can be lost with the host, disk, or account compromise and
   is not a recovery plan.

## Isolated Restore Drill

1. Use a disposable host or isolated Compose project with **new** database volumes, a new resume
   target on a private filesystem, and separate credentials. Ensure no production paths, volumes,
   databases, or traffic are referenced. Do not start Caddy or publish ports. Prefer a synthetic
   backup; handle real dumps as sensitive personal data if a real restore is necessary.
2. Retrieve and decrypt the matched pair, verify `SHA256SUMS`, and use the recorded release and
   PostgreSQL major version. Inspect the archive before extraction and restore only from a trusted
   backup. Initialize an empty PostgreSQL target and wait for health. Run the following **only**
   using a `restore_dc` helper defined like `dc` but pointing at the isolated project and env file:

   ```sh
   restore_dc up -d --wait postgres
   restore_dc exec -T postgres sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error --no-owner --no-privileges' \
     < "$BACKUP_DIR/postgres.dump"
   sudo tar --numeric-owner -xpf "$BACKUP_DIR/resumes.tar" -C "$RESTORE_RESUME_DIR"
   ```

   `RESTORE_RESUME_DIR` must already exist and be empty. Verify UID/GID `1000:1000`, permissions,
   the backing filesystem, and `.storage-id`. Set the isolated `RESUME_STORAGE_ID` to the restored
   value; restore the files and marker together. With the flags above the restoring role owns the
   objects and prior grants are not replayed; recreate separate roles/grants when applicable. See
   [PostgreSQL 17 `pg_dump`](https://www.postgresql.org/docs/17/app-pgdump.html) and
   [`pg_restore`](https://www.postgresql.org/docs/17/app-pgrestore.html).

3. Compare the ledger with the recorded release. Reconcile post-backup account and resume deletion
   requests before restoring any public service; a restore can resurrect data. Then build the
   matching image and start only the isolated backend: `restore_dc build backend` and
   `restore_dc up -d --wait backend`. Do not automatically migrate to a different release. Verify
   `/ready` inside the container, expected row counts, a sample resume download and owner isolation,
   and worker behavior with synthetic data. Record timings and missing data. Destroy only the
   disposable resources and securely remove temporary copies when finished.

Deleted resumes may remain in backups until expiration. Document the actual retention window and
how deletion requests are reconciled on restore. Readiness validates the migration ledger and
mount, not that every file or database row has been restored correctly.

## Monitoring Checklist

Choose a destination that alerts even when EC2 is down. Define thresholds, the responder, and an
escalation path based on observed production behavior. Do not collect tokens, document contents,
file paths, or sensitive request data in monitoring.

| Signal           | Observe and respond                                                                                                                                                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API and TLS      | Probe `/ready` externally from an authorized location; watch repeated errors, latency, and certificate expiration. Use `/health` only to distinguish a live process.                                                                                                  |
| Disk and inodes  | Monitor Docker's data root, PostgreSQL, resumes, backups, and logs. Alert before critical space or inode exhaustion and configure log rotation.                                                                                                                       |
| Database         | Monitor container health, restarts, readiness failures, and connection/resource pressure. A healthy `pg_isready` does not prove the app credentials or schema work.                                                                                                   |
| Reminder worker  | Alert on `Reminder processing failed`. Run a periodic synthetic due-reminder check in a controlled account; there is no successful-run heartbeat, and quiet logs do not prove it ran.                                                                                 |
| Resume cleanup   | Alert on `Could not process pending resume cleanup` and repeated `Resume file cleanup will be retried`. Track the count of pending `resumes.cleanup_due_at` markers and how overdue the oldest one is; alert on sustained growth or staleness. Check the mount first. |
| Backup freshness | Alert when no complete matching pair is verified off host within the chosen interval. Record restore-drill age and results separately.                                                                                                                                |

Compose does not restart a container just because it becomes unhealthy. Inspect `dc ps` and
sanitized service logs first, fix the root cause, and verify readiness and data access after any
restart. Set up monitoring and test the alert delivery path before accepting real users.
