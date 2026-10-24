#!/usr/bin/env bash
# Build and (re)start the stack on the EC2 host, with health check + automatic rollback.
# Run from anywhere on the server:  ./deploy/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env"
IMAGE="skillpath-api"

# Keep the currently running image so we can roll back.
if docker image inspect "$IMAGE:latest" >/dev/null 2>&1; then
  docker tag "$IMAGE:latest" "$IMAGE:previous"
fi

echo "==> Building and starting"
$COMPOSE up -d --build --remove-orphans

echo "==> Waiting for API health"
for i in $(seq 1 30); do
  status=$(docker inspect --format '{{.State.Health.Status}}' "$($COMPOSE ps -q api)" 2>/dev/null || echo starting)
  if [ "$status" = "healthy" ]; then
    echo "API healthy"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 5
done

echo "!! API did not become healthy. Logs:"
$COMPOSE logs --tail=50 api || true

if docker image inspect "$IMAGE:previous" >/dev/null 2>&1; then
  echo "==> Rolling back to previous image"
  docker tag "$IMAGE:previous" "$IMAGE:latest"
  $COMPOSE up -d --no-build api
fi
exit 1
