#!/bin/sh
set -e
if [ "${SKIP_MIGRATIONS:-}" != "1" ] && [ -n "${DATABASE_URL:-}" ]; then
  npx prisma migrate deploy
fi
exec "$@"
