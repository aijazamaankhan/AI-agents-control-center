#!/bin/sh
# Container start: ensure secrets exist (persisted in /data), migrate, then serve.
set -e
mkdir -p /data
for KEY in AUTH_SECRET ENCRYPTION_KEY; do
  eval "VALUE=\${$KEY:-}"
  if [ -z "$VALUE" ]; then
    FILE="/data/$(echo "$KEY" | tr 'A-Z' 'a-z')"
    [ -f "$FILE" ] || node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))" > "$FILE"
    export "$KEY=$(cat "$FILE")"
  fi
done
npx prisma migrate deploy
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
