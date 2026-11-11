#!/bin/sh
set -e

if [ "${APPLY_MIGRATIONS:-false}" = "true" ]; then
  echo "Applying explicitly enabled Prisma migrations..."
  npx --no-install prisma migrate deploy --schema=prisma/schema.prisma
else
  echo "Checking migration state (automatic application disabled)..."
  npx --no-install prisma migrate status --schema=prisma/schema.prisma
fi

echo "Starting backend..."
exec node dist/server.js
