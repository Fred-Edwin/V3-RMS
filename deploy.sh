#!/usr/bin/env bash
# Wendo RMS — Production Deploy Script
# Called by GitHub Actions after the image is built and pushed to ghcr.io.
# Usage: bash deploy.sh <image-tag>
# Example: bash deploy.sh sha-a1b2c3d

set -e

IMAGE_TAG="${1:?ERROR: image tag argument is required. Usage: bash deploy.sh <sha-tag>}"

echo "=== Wendo RMS Deploy ==="
echo "Started at: $(date)"
echo "Image: ghcr.io/fred-edwin/v3-rms-backend:$IMAGE_TAG"

# Pull latest code (docker-compose.yml, deploy.sh — not the app itself, that's in the image)
echo "--- Pulling latest repo files..."
git pull origin main

# Write IMAGE_TAG into the root .env so docker-compose.yml can substitute ${IMAGE_TAG}
# Updates the line if it already exists, appends it if not
if grep -q "^IMAGE_TAG=" .env 2>/dev/null; then
  sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=$IMAGE_TAG|" .env
else
  echo "IMAGE_TAG=$IMAGE_TAG" >> .env
fi

# Pull the pre-built image from ghcr.io (no compilation on the server)
echo "--- Pulling image..."
IMAGE_TAG="$IMAGE_TAG" docker compose pull api worker

# Run database migrations using a one-off container from the NEW image
# Runs BEFORE replacing the live containers so the schema is ready for the new code
echo "--- Running database migrations..."
IMAGE_TAG="$IMAGE_TAG" docker compose run --rm --no-deps \
  -e START_BULLMQ_WORKERS=false \
  api \
  npx prisma migrate deploy

# Swap api and worker to the new image (postgres and redis keep running — no data risk)
# --pull never: image was already pulled above; skip redundant pull attempt
echo "--- Restarting API and worker..."
IMAGE_TAG="$IMAGE_TAG" docker compose up -d --no-deps --pull never api worker

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
  echo "!!! API failed health check after 60 seconds. Last logs:"
  docker compose logs api --tail=50
  echo ""
  echo "To rollback to the previous image, run:"
  echo "  bash deploy.sh <previous-sha-tag>"
  echo "(Find previous tags in: GitHub Actions history or \`docker images ghcr.io/fred-edwin/v3-rms-backend\`)"
  exit 1
fi

echo "--- API is healthy."

# Remove dangling image layers (unreferenced by any tag or running container)
# Do NOT prune builder cache — there is no builder on this server anymore
echo "--- Cleaning up dangling images..."
docker image prune -f

echo ""
echo "=== Deploy complete at $(date) ==="
echo "=== Health: $(curl -sf http://localhost:4000/api/v1/health) ==="
