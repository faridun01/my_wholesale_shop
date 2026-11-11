#!/bin/sh
set -e

if [ "${APPLY_MIGRATIONS:-false}" = "true" ]; then
  echo "Applying explicitly enabled Prisma migrations..."
  npx --no-install prisma migrate deploy --schema=prisma/schema.prisma
else
  echo "Checking migration state (automatic application disabled)..."
  # Never serve on a schema older than the code: stop with a clear instruction instead.
  if ! npx --no-install prisma migrate status --schema=prisma/schema.prisma; then
    echo "ERROR: the database is unreachable or has migrations this release needs that are not applied." >&2
    echo "Back up the database, then start the backend once with APPLY_MIGRATIONS=true (see DOCKER_DEPLOY.md)." >&2
    exit 1
  fi
fi

echo "Starting backend..."
exec node dist/server.js
