#!/usr/bin/env bash
# Wendo RMS — Production Deploy Script
# Run from /home/wendo/wendo-rms on the server
# Usage: ./deploy.sh
# With migration: docker compose run --rm api npx prisma migrate deploy && ./deploy.sh

set -e  # Exit immediately on any error

echo "=== Wendo RMS Deploy ==="
echo "Started at: $(date)"

# Pull the latest code from main
echo "--- Pulling latest code..."
git pull origin main

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
  if curl -sf -o /dev/null -w "%{http_code}" http://localhost:4000/api/v1/auth/login -X POST -H "Content-Type: application/json" -d '{}' | grep -qE '^[24]'; then
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

# Remove dangling images from previous builds to free disk space
echo "--- Cleaning up old Docker images..."
docker image prune -f

echo ""
echo "=== Deploy complete at $(date) ==="
echo "=== Health: OK ==="
