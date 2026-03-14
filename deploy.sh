#!/usr/bin/env bash
# Wendo RMS — Production Deploy Script
# Run from ~/wendo-rms on the server
# Usage: ./deploy.sh

set -e  # Exit immediately on any error

echo "=== Wendo RMS Deploy ==="
echo "Started at: $(date)"

# Pull the latest code from main
echo "--- Pulling latest code..."
git pull origin main

# Run any pending database migrations (uses the already-running api container)
echo "--- Running database migrations..."
docker compose exec api npx prisma migrate deploy

# Rebuild only the application images (postgres and redis are not rebuilt)
echo "--- Building new images..."
docker compose build api worker

# Restart only the application containers (databases keep running — no data risk)
echo "--- Restarting API and worker..."
docker compose up -d --no-deps api worker

# Wait for the API health check to pass
echo "--- Waiting for API health check..."
sleep 5
HEALTHY=false
for i in {1..12}; do
  if curl -sf http://localhost:4000/api/v1/health > /dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  echo "--- Waiting... attempt $i/12"
  sleep 5
done

if [ "$HEALTHY" = false ]; then
  echo ""
  echo "!!! API failed to start after 60 seconds. Last logs:"
  docker compose logs api --tail=50
  echo ""
  echo "!!! Deploy FAILED. Fix the issue and re-run ./deploy.sh"
  exit 1
fi

echo "--- API is healthy."

# Remove dangling images and build cache older than 24h to free disk space
# Keeps recent cache so the next deploy stays fast
echo "--- Cleaning up old Docker images and build cache..."
docker image prune -f
docker builder prune -f --filter "until=24h"

echo ""
echo "=== Deploy complete at $(date) ==="
echo "=== Health: $(curl -sf http://localhost:4000/api/v1/health) ==="
