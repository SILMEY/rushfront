#!/bin/sh
set -e

PORT="${PORT:-3000}"

# Serveur health minimal pendant le build — répond 200 immédiatement
# pour que Railway valide le healthcheck pendant npm run build
node -e "
  const s = require('http').createServer((_, r) => { r.writeHead(200); r.end('ok'); });
  s.listen(parseInt('$PORT'), '0.0.0.0', () => console.log('[health] ready on $PORT'));
" &
HEALTH_PID=\$!

echo '[start] building frontend...'
npm run build
echo '[start] build done'

# Arrêter le serveur health
kill \$HEALTH_PID 2>/dev/null || true
wait \$HEALTH_PID 2>/dev/null || true

# Générer la config nginx avec le bon PORT
sed "s/__PORT__/$PORT/g" /app/frontend/nginx.conf > /tmp/nginx_app.conf

echo "[start] starting nginx on port $PORT"
exec nginx -c /tmp/nginx_app.conf -g 'daemon off;'
