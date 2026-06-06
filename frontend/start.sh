#!/bin/sh
PORT="${PORT:-3000}"

echo "[start] health server on port $PORT..."

# Répond 200 immédiatement pendant le build pour passer le healthcheck Railway
node -e "require('http').createServer(function(_,r){r.writeHead(200);r.end('ok');}).listen($PORT,'0.0.0.0',function(){console.log('[health] ready');})" &
HEALTH_PID=$!

echo "[start] building..."
npm run build
BUILD_CODE=$?

echo "[start] build finished (exit=$BUILD_CODE), stopping health server..."
kill $HEALTH_PID 2>/dev/null || true
wait $HEALTH_PID 2>/dev/null || true
sleep 1

if [ $BUILD_CODE -ne 0 ]; then
  echo "[start] build failed"
  exit $BUILD_CODE
fi

echo "[start] starting http-server on port $PORT"
exec npm run serve
