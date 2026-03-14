# Geod — Network Monitoring & Chaos Engineering Platform

Geod is a real-time network monitoring and chaos engineering platform built for distributed infrastructure. It provides a visual dashboard to observe network topology, monitor link metrics (latency, packet loss), and inject chaos (latency, packet loss, bandwidth limits) into live network paths — all from a web UI.

## Architecture

```
┌──────────────────┐      WebSocket       ┌──────────────────┐
│     Frontend     │◄────────────────────►│     Backend      │
│  React + Vite    │      REST API        │  Flask + SocketIO│
│  :5173           │─────────────────────►│  :5000           │
└──────────────────┘                      └───────┬──────────┘
                                                  │ WebSocket
                                    ┌─────────────┼─────────────┐
                                    ▼             ▼             ▼
                              ┌──────────┐ ┌──────────┐ ┌──────────┐
                              │  Agent   │ │  Agent   │ │  Agent   │
                              │  (node)  │ │  (node)  │ │  (node)  │
                              └──────────┘ └──────────┘ └──────────┘
```

| Component    | Tech                                         | Description                                                                                                     |
| ------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Backend**  | Flask, SocketIO, eventlet, NetworkX          | REST API + WebSocket server. Manages topology, routes chaos commands to agents, serves Prometheus metrics.      |
| **Frontend** | React, TypeScript, Vite, ReactFlow, Recharts | Dashboard with interactive topology graph, real-time metrics charts, and chaos engineering controls.            |
| **Agent**    | Python, psutil, python-socketio              | Deployed on each monitored node. Reports system/network stats, executes chaos commands (tc), runs iperf3 tests. |
| **Infra**    | Docker Compose, enoslib (Grid'5000)          | Deployment automation for local dev, demo mode, and Grid'5000 clusters.                                         |

---

## Quick Start (Local Docker)

This is the easiest way to try Geod locally. It launches the backend, frontend, 7 simulated agents (Paris, London, New York, Tokyo, Sydney, Toronto, Berlin), and Prometheus.

### Prerequisites

- Docker and Docker Compose installed
- Ports `5001`, `5173`, and `9090` available

### 1. Start all services

```bash
cd geod/infra/
docker-compose up --build
```

### 2. Push the topology

The topology defines which agents have monitored links between them. Without this step, the graph will show nodes but **no edges**.

```bash
pip install pyyaml requests
python push_topology.py --backend http://localhost:5001 --file topology.yaml
```

### 3. Open the dashboard

| Service          | URL                           |
| ---------------- | ----------------------------- |
| Frontend         | http://localhost:5173         |
| Backend API      | http://localhost:5001         |
| Swagger API Docs | http://localhost:5001/apidocs |
| Prometheus       | http://localhost:9090         |

> **Note:** In Docker Compose, the backend is mapped to port **5001** (not 5000).

---

## Manual Setup (Without Docker)

If you prefer running each component separately (useful for development).

### Prerequisites

- Python 3.8+
- Node.js 18+ and npm
- Root/sudo privileges (for the agent's network manipulation features)

### 1. Start the Backend

```bash
cd geod/backend/
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

The backend runs at `http://localhost:5000`.

### 2. Start the Frontend

```bash
cd geod/frontend/
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

> **Tip:** To point the frontend to a non-default backend URL, create a `.env` file:
>
> ```
> VITE_BACKEND_URL=http://your-backend-host:5000
> ```

### 3. Start Agent(s)

Each agent requires root privileges for `tc` (traffic control) operations:

```bash
cd geod/agent/
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
sudo python agent.py --backend http://localhost:5000
```

Agent CLI options:

| Flag                     | Default                 | Description                        |
| ------------------------ | ----------------------- | ---------------------------------- |
| `--backend`, `-b`        | `http://localhost:5000` | Backend server URL                 |
| `--stats-interval`, `-s` | `5`                     | Stats reporting interval (seconds) |
| `--heartbeat-interval`   | `10`                    | Heartbeat interval (seconds)       |
| `--no-reconnect`         | off                     | Disable automatic reconnection     |
| `--verbose`, `-v`        | off                     | Enable verbose logging             |

### 4. Push Topology

```bash
cd geod/infra/
python push_topology.py --backend http://localhost:5000 --file topology.yaml
```

---

## Using the Dashboard

Once all services are running and the topology is pushed, open the frontend URL in your browser. The app has three pages accessible from the sidebar:

### Dashboard (`/dashboard`)

The main view with:

- **Stats cards** — Active links, network nodes, average latency, and latency alerts (links > 100ms)
- **Topology graph** — Interactive ReactFlow graph showing all nodes and links. Nodes update in real-time via WebSocket. Click a node to open its configuration panel.

### Nodes (`/dashboard/noeuds`)

Lists all connected agents with their hostname, IP address, OS, and connection time. Agents appear/disappear in real-time as they connect or disconnect.

### Metrics (`/dashboard/metriques`)

In-depth monitoring with:

- Per-agent system metrics (CPU, memory, disk, network I/O)
- Historical charts powered by Prometheus
- Select any agent from the dropdown to drill into its metrics

### Topology Interactions

- **Click a node** → Opens the **Node Config Panel** with two tabs:
  - **Chaos** tab: Apply chaos rules (latency, packet loss, bandwidth limit) to all outgoing traffic from that node
  - **Target** tab: Apply targeted rules to specific destination IPs
- **Click a link/edge** → Shows live latency and packet loss stats for that connection
- **Right-click a node** → Context menu with quick actions

### Applying Chaos Rules

From the Node Config Panel:

1. Click a node on the topology graph
2. Go to the **Chaos** tab
3. Fill in any combination of:
   - **Latency** — e.g., `100ms`, `50ms`
   - **Packet Loss** — e.g., `5%`, `10%`
   - **Bandwidth Limit** — e.g., `10mbit`, `1mbit`
4. Click **Set Global Rule**, then **Apply Rule**
5. To remove: click **Clear Rule**

> **Important:** The agent needs root privileges and Linux `tc` for chaos rules to take effect. On macOS/Windows, the commands will fail silently.

---

## Topology Configuration

The topology is a YAML file defining which links exist between agents. Only explicitly defined links appear as edges on the graph and get monitored (latency/loss measurements via ping).

### Format

```yaml
topology:
  links:
    - src: paris
      dst: london
      delay: 8ms
      rate: 1gbit

    - src: london
      dst: new-york
      delay: 75ms
      rate: 500mbit
```

- **`src`/`dst`**: Agent hostnames (must match the hostname reported by the agent)
- **`delay`**: Expected latency (informational, displayed on edges)
- **`rate`**: Expected bandwidth (informational)

### Push/Update Topology (No Restart Needed)

```bash
python push_topology.py --backend <BACKEND_URL> --file <YAML_FILE>
```

You can push a new topology at any time — the frontend updates live via WebSocket.

---

## Deployment Modes

### 1. Local Docker Compose (Development)

See [Quick Start](#quick-start-local-docker) above.

### 2. Demo Mode

A focused stack for chaos engineering demos with a Flask webapp and Redis:

```bash
cd geod/infra/
docker-compose -f docker-compose.demo.yml up --build
```

### 3. Grid'5000 — Full Stack

Deploys backend, frontend, Prometheus, and agents across Grid'5000 sites. All configuration is driven by `infra/infra.yaml`.

```bash
cd geod/infra/
python -m venv venv
source venv/bin/activate
pip install enoslib pyyaml
python deploy_infra.py
```

The script will:

1. Reserve nodes across sites
2. Deploy backend + Prometheus on the manager node
3. Deploy the frontend (installs Node.js automatically)
4. Deploy agents on all agent nodes
5. Push the topology configuration automatically

After deployment, use the SSH tunnel printed in the terminal to access the services from your local machine:

```bash
ssh -L 5000:<manager>:5000 \
    -L 5173:<manager>:5173 \
    -L 9090:<manager>:9090 \
    -J <user>@access.grid5000.fr \
    <user>@f<site>.grid5000.fr
```

Then open `http://localhost:5173` in your browser.

### 4. Grid'5000 — Agent Only

If the backend is already running, deploy just the agents:

```bash
cd geod/infra/
python -m venv venv
source venv/bin/activate
pip install enoslib
python deploy_agent.py
```

---

## API Reference

The backend exposes a Swagger UI at `/apidocs` (e.g., `http://localhost:5000/apidocs`).

Key endpoints:

| Method | Endpoint                     | Description                          |
| ------ | ---------------------------- | ------------------------------------ |
| GET    | `/api/topology`              | Get current topology (nodes + links) |
| PUT    | `/api/topology`              | Update topology structure            |
| POST   | `/api/topology/config`       | Push topology link definitions       |
| GET    | `/api/agents`                | List connected agents                |
| GET    | `/api/history`               | Get historical metrics (Prometheus)  |
| GET    | `/metrics`                   | Prometheus scrape endpoint           |
| POST   | `/api/chaos/host/<hostname>` | Apply chaos rules to a host          |
| DELETE | `/api/chaos/host/<hostname>` | Clear chaos rules from a host        |
| POST   | `/api/quick/latency`         | Quick-add latency                    |
| POST   | `/api/quick/loss`            | Quick-add packet loss                |
| POST   | `/api/quick/clear`           | Quick-clear all rules                |
| POST   | `/api/execute`               | Execute a command on an agent        |
| GET    | `/api/services`              | List discovered services/containers  |

---

## Configuration Files

| File                      | Location    | Description                                                                   |
| ------------------------- | ----------- | ----------------------------------------------------------------------------- |
| `infra.yaml`              | `infra/`    | Grid'5000 infrastructure definition (machines, topology, network constraints) |
| `topology.yaml`           | `infra/`    | Topology link definitions for local Docker dev                                |
| `docker-compose.yml`      | `infra/`    | Local dev stack (7 agents + backend + frontend + Prometheus)                  |
| `docker-compose.demo.yml` | `infra/`    | Demo stack (webapp + Redis + chaos agent)                                     |
| `prometheus.yml`          | `infra/`    | Prometheus scrape config for local dev                                        |
| `.env`                    | `frontend/` | Override `VITE_BACKEND_URL` for the frontend                                  |

---

## Troubleshooting

### No nodes appear on the dashboard

- Make sure the backend is running and at least one agent is connected
- Check that the frontend's `VITE_BACKEND_URL` points to the correct backend
- In Docker: the backend is on port **5001**, not 5000

### No edges/links on the topology graph

- You need to push the topology: `python push_topology.py --backend <URL> --file topology.yaml`
- Make sure `src`/`dst` hostnames in the topology YAML match the agent hostnames exactly

### WebSocket connection fails

- Verify CORS settings — the backend allows all origins by default
- On Grid'5000, ensure SSH tunnels are active and forwarding the correct ports
- Check that `eventlet` monkey-patching is working (it must be imported first in `app.py`)

### Chaos rules don't take effect

- Agents must run with **root/sudo** privileges
- `tc` (traffic control) is only available on **Linux**
- Check agent logs for errors: `sudo python agent.py --verbose`

### Metrics page shows no data

- Ensure Prometheus is running and scraping the backend (`/metrics` endpoint)
- Verify the `hostname` query parameter matches an actual connected agent
