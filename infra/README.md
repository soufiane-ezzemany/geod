# Infrastructure

This directory contains all deployment configurations and scripts for running GeoD in different environments.

## Deployment Modes

### 1. Local Development (Docker Compose)

Runs 3 simulated agents (Paris, New York, Tokyo) with backend, frontend, and Prometheus on a single machine.

```bash
docker-compose up --build
```

Then push the topology config to enable link monitoring:

```bash
pip install pyyaml requests
python push_topology.py --backend http://localhost:5001 --file topology.yaml
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5001
- Prometheus: http://localhost:9090

### 2. Demo Mode (Docker Compose)

A focused stack for chaos engineering demos with a Flask webapp and Redis.

```bash
docker-compose -f docker-compose.demo.yml up --build
```

### 3. Docker Swarm

Production multi-node deployment with 5 agents across an overlay network. See [swarm/README.md](swarm/README.md) for details.

### 4. Grid5000 — Full Stack

Deploys backend, frontend, Prometheus, and agents across Grid5000 sites. All configuration is driven by `infra.yaml`.

```bash
python -m venv venv
source venv/bin/activate
pip install enoslib pyyaml
python deploy_infra.py
```

To use a custom config:

```bash
python deploy_infra.py --config custom-infra.yaml
```

### 5. Grid5000 — Agent Only

Deploys only agents (useful when the backend is already running).

```bash
python -m venv venv
source venv/bin/activate
pip install enoslib
python deploy_agent.py
```

## Configuration Files

| File | Description |
|------|-------------|
| `infra.yaml` | Grid5000 infrastructure definition (machines, topology, constraints) |
| `topology.yaml` | Topology link definitions for local Docker dev |
| `docker-compose.yml` | Local dev stack (3 agents + backend + frontend + Prometheus) |
| `docker-compose.demo.yml` | Demo stack (webapp + Redis + chaos agent) |
| `prometheus.yml` | Prometheus scrape config for local dev |

## Topology Management

The topology defines which agents have monitored links between them. Only explicitly defined links appear as edges in the frontend graph.

Push or update the topology at any time without restarting:

```bash
python push_topology.py --backend <BACKEND_URL> --file <YAML_FILE>
```

Example:

```bash
# Local Docker
python push_topology.py --backend http://localhost:5001 --file topology.yaml

# Grid5000 (from manager node)
python push_topology.py --backend http://localhost:5000 --file infra.yaml
```
