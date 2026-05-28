#!/bin/sh
set -eu

echo "[backend] generating prisma client"
npm run prisma:generate >/dev/null

echo "[backend] applying prisma migrations (deploy)"
npx prisma migrate deploy

echo "[backend] starting dev server"
exec npm run dev

