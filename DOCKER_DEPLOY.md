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

Before the first run, edit `Caddyfile` at the repo root and set your domain
(it currently points at `crm.itforce.pro`) — the domain must already resolve
(DNS A/AAAA record) to this server's public IP, and ports 80/443 must be
reachable from the internet, or Caddy's automatic Let's Encrypt certificate
issuance will fail.

## 2) Build and run

```bash
docker compose up -d --build
```

## 3) Verify services

- Frontend: `https://crm.itforce.pro` (Caddy automatically obtains/renews a
  Let's Encrypt certificate for the domain and redirects HTTP → HTTPS; no
  manual certbot steps needed)
- Backend health: `https://crm.itforce.pro/api/health`

Certificates and the ACME account key are persisted in the `caddy_data`
Docker volume — back it up along with `postgres_data` and `backend_uploads`,
and avoid `docker compose down -v` in production (it deletes all named
volumes, including certificates and the database).

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

