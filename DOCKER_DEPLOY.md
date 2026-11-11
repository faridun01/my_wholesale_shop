# Docker Deploy

## 1) Prepare environment

Copy root docker env template:

```bash
cp .env.docker.example .env
```

Required variables:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `TWO_FACTOR_BACKUP_PEPPER`

Optional:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `CORS_ORIGINS`
- `FRONTEND_ORIGIN`
- `COOKIE_SECURE`
- `ALLOW_UPLOAD_QUERY_TOKEN`
- `CSP_REPORT_ONLY`
- `CSP_REPORT_URI`
- `FRONTEND_PORT` (default `8080`)

## Architecture

```text
Internet --443/80--> systemd Caddy (host, /etc/caddy/Caddyfile)
                          |
                          v  127.0.0.1:8080
                    frontend container (nginx) --/api/, /uploads/--> backend:3001
                          ^                                              |
                     Docker network only                                 v
                                                                    postgres:5432
```

TLS termination is **not** done by Docker — it's handled by a systemd-managed
Caddy already running on the host. Docker Compose only publishes the
`frontend` container to `127.0.0.1:${FRONTEND_PORT:-8080}` (loopback-only, not
reachable from outside the server); `backend` and `postgres` are never
published to the host at all, only reachable over the internal Docker
network. Do not add a second Caddy/TLS proxy inside Docker — it will race the
host Caddy for ports 80/443.

The host's `/etc/caddy/Caddyfile` should contain (verify it already does —
don't touch it if so):

```caddyfile
crm.itforce.pro {
    reverse_proxy 127.0.0.1:8080
}
```

## 2) Build and run

For the fastest VPS updates, the `master` GitHub Actions workflow builds and
publishes the backend and frontend images to GHCR after checks pass. The Compose
file still includes build contexts for local development, but the VPS should
pull the ready-made images instead of compiling them.

If the GHCR packages are private, authenticate once on the VPS using a GitHub
Personal Access Token (classic) with `read:packages`. Keep the token out of
shell history and never commit it:

```bash
read -rsp "GitHub token: " GHCR_TOKEN; echo
echo "$GHCR_TOKEN" | docker login ghcr.io -u GITHUB_USERNAME --password-stdin
unset GHCR_TOKEN
```

After the workflow for the new commit has completed successfully, update the
VPS without running a local build.

The backend never applies database migrations on its own. On start it checks
the migration state and, if this release needs migrations that are not applied
yet, it stops with an error instead of serving on an old schema. Apply them
explicitly, right after a backup:

```bash
# 1. Back up the database (see "Database Backup" below) and check the file is not empty.
# 2. Pull the new images.
docker compose pull backend frontend
# 3. Start the backend once with migrations enabled (only this command; .env keeps false).
APPLY_MIGRATIONS=true docker compose up -d --no-build backend
docker compose logs backend | grep -E "migration|Server running"
# 4. Start the frontend and check.
docker compose up -d --no-build frontend
docker compose ps
curl -fsS https://crm.itforce.pro/api/health
```

A release without new migrations can use plain `docker compose up -d --no-build
backend frontend`; `APPLY_MIGRATIONS=true` is harmless when nothing is pending.

If GHCR packages are public, the login step is not needed. To deploy a specific
published image tag instead of the default `master`, set `IMAGE_TAG` in the
server's `.env` before pulling.

### Rollback

Every published image is also tagged with its full commit SHA
(`sha-<40-char-commit>`). To return to the previous release:

```bash
IMAGE_TAG=sha-<previous-commit> docker compose pull backend frontend
IMAGE_TAG=sha-<previous-commit> docker compose up -d --no-build backend frontend
```

Migrations are forward-only and additive, so older code keeps working on the
newer schema in the normal case. Restore the pre-release database backup only
if a migration itself damaged data — a restore discards every operation made
after the backup.

To build from source locally, use:

```bash
docker compose up -d --build
```

## 3) Verify services

- Frontend (via host Caddy): `https://crm.itforce.pro`
- Frontend (direct, from the server itself only): `http://127.0.0.1:8080`
- Backend health: `https://crm.itforce.pro/api/health`
- `docker compose ps` — all three containers should show `healthy`
- `sudo systemctl status caddy` — host Caddy should be `active (running)`

Back up `postgres_data` and `backend_uploads` (see below); avoid
`docker compose down -v` in production (it deletes all named volumes,
including the database). Caddy's TLS certificates live on the host (typically
`/var/lib/caddy`), outside of Docker — back that up separately if needed.

## 4) Useful commands

```bash
docker compose logs -f
docker compose ps
docker compose down
docker compose down -v
```

## 5) Database Backup

Run database backup locally or via Docker:

```bash
# Linux/macOS:
./backend/scripts/backup.sh

# Windows PowerShell:
.\backend\scripts\backup.ps1

# Docker container dump (custom format, restorable with pg_restore):
mkdir -p backups
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "backups/backup_$(date +%Y%m%d_%H%M%S).dump"
ls -lh backups   # an empty or tiny file means the backup failed
```

Restore (stops writes first; replaces the current data):

```bash
docker compose stop backend
docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < backups/<file>.dump
docker compose start backend
```
