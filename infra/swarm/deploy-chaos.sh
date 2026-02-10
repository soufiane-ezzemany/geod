#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Building images ==="
docker build -t geod-backend:latest ../../backend
docker build -t geod-agent:latest ../../agent
docker build -t geod-demo-webapp:latest ../demo-webapp

echo ""
echo "=== Deploying stack ==="
docker stack deploy -c docker-compose.chaos.yml geod-chaos

echo ""
echo "=== Waiting for services ==="
sleep 10

echo ""
echo "=== Stack status ==="
docker stack services geod-chaos

echo ""
echo "=== Access URLs ==="
echo "  Backend:    http://localhost:5001"
echo "  Webapp:     http://localhost:8080"
echo "  Prometheus: http://localhost:9090"
echo ""
echo "=== Test chaos ==="
echo "  curl http://localhost:8080/ping-redis"
echo "  ../scripts/chaos-test.sh"
