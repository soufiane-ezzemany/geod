# GeoD Grid5000 Deployment

Deploy GeoD Chaos Engineering on Grid5000 with Docker Swarm.

## Prerequisites

1. Grid5000 account
2. Python 3.8+

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Configure Grid5000 credentials
cat > ~/.python-grid5000.yaml << EOF
username: YOUR_LOGIN
password: YOUR_PASSWORD
EOF
chmod 600 ~/.python-grid5000.yaml
```

## Usage

```bash
# Deploy on Rennes/parasilo with 3 nodes
python deploy_swarm.py

# Deploy on different site/cluster
python deploy_swarm.py --site nancy --cluster gros --nodes 5

# Custom walltime
python deploy_swarm.py --walltime 2:00:00
```

## What it does

1. Reserves nodes on Grid5000
2. Deploys Debian with Docker
3. Initializes Docker Swarm cluster
4. Builds GeoD images (backend, agent, demo-webapp)
5. Deploys the chaos stack
6. Runs chaos engineering tests
7. Provides access URLs

## Manual testing

Once deployed, you can SSH to the manager and run:

```bash
# Check services
docker stack services geod-chaos

# Check agents
curl http://localhost:5001/api/agents

# Inject chaos (replace AGENT and CONTAINER)
curl -X POST http://localhost:5001/api/chaos/external/AGENT \
  -H "Content-Type: application/json" \
  -d '{"container_id": "CONTAINER", "rules": [{"effects": {"latency": "200ms"}}]}'

# Test
curl http://localhost:8080/ping-redis

# Clear
curl -X DELETE http://localhost:5001/api/chaos/external/AGENT/CONTAINER
```
