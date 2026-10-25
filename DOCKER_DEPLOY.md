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
VPS without running a local build:

```bash
docker compose pull backend frontend
docker compose up -d --no-build backend frontend
docker compose ps
curl -fsS https://crm.itforce.pro/api/health
```

If GHCR packages are public, the login step is not needed. To deploy a specific
published image tag instead of the default `master`, set `IMAGE_TAG` in the
server's `.env` before pulling.

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

# Docker container dump:
docker compose exec postgres pg_dump -U postgres wholesale_shop | gzip > ./backups/backup_$(date +%Y%m%d).sql.gz
```
