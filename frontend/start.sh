#!/bin/sh
set -e

PORT="${PORT:-3000}"

# Serveur health minimal pendant le build
# Répond 200 immédiatement pour que Railway valide le healthcheck
node -e "require('http').createServer(function(_,r){r.writeHead(200);r.end('ok');}).listen($PORT,'0.0.0.0',function(){console.log('[health] up on $PORT');})" &
HEALTH_PID=$!

echo "[start] building frontend (pid health=$HEALTH_PID)..."
npm run build
echo "[start] build ok"

# Tuer le serveur health et attendre la libération du port
kill $HEALTH_PID 2>/dev/null || true
wait $HEALTH_PID 2>/dev/null || true
sleep 1

# Générer la config nginx avec le bon PORT
sed "s/__PORT__/$PORT/g" /app/frontend/nginx.conf > /tmp/nginx_app.conf

echo "[start] starting nginx on $PORT"
exec nginx -c /tmp/nginx_app.conf -g 'daemon off;'
