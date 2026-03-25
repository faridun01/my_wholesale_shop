# Docker Deploy

1. Copy `.env.docker.example` to `.env`.
2. Fill in `JWT_SECRET` and `OCR_API_KEY`.
3. Run:

```bash
docker compose up -d --build
```

4. Open:

```txt
http://localhost
```

Services:
- `frontend` serves the Vite build through nginx
- `backend` runs Prisma migrations on start and then starts the API
- `postgres` stores application data

Useful commands:

```bash
docker compose logs -f
docker compose down
docker compose down -v
```
