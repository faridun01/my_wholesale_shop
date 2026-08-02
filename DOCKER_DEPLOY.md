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
- `OCR_API_KEY`

Optional:
- `POSTGRES_DB`
- `POSTGRES_USER`
- `FRONTEND_PORT`
- `CORS_ORIGINS`
- `FRONTEND_ORIGIN`
- `COOKIE_SECURE`
- `ALLOW_UPLOAD_QUERY_TOKEN`
- `CSP_REPORT_ONLY`
- `CSP_REPORT_URI`

## 2) Build and run

```bash
docker compose up -d --build
```

## 3) Verify services

- Frontend: `http://localhost`
- Backend health: `http://localhost/api/health`

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

