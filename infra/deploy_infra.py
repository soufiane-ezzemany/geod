#!/usr/bin/env python3
"""
Grid'5000 Full Infrastructure Deployment Script

Reads all configuration from infra.yaml and deploys:
- Backend (Flask+SocketIO) + Prometheus on manager node(s)
- Frontend (Vite) on frontend node(s)
- Agents on agent nodes across sites

Usage:
    python deploy_infra.py
    python deploy_infra.py --config custom-infra.yaml
"""

import argparse
import logging
import socket
import os
import time
import tempfile
import shutil
import yaml
import enoslib as en

# =============================================================================
# Paths (relative to this script)
# =============================================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "backend"))
FRONTEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "frontend"))
AGENT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "agent"))
DEFAULT_INFRA_YAML = os.path.abspath(os.path.join(SCRIPT_DIR, "infra.yaml"))

REMOTE_BACKEND_DIR = "~/backend"
REMOTE_FRONTEND_DIR = "~/frontend"
REMOTE_AGENT_DIR = "~/agent"

BACKEND_PORT = 5000
FRONTEND_PORT = 5173
PROMETHEUS_PORT = 9090

# Directories to exclude when copying
EXCLUDED_DIRS = ["venv", "node_modules", "__pycache__", ".git", "dist", ".venv"]

# =============================================================================
# Helper Functions
# =============================================================================

def copy_dir_excluding(src_dir: str, dest_dir: str, excludes: list[str]) -> str:
    """
    Copy a directory to a temporary location, excluding specified subdirectories.
    Returns the path to the temporary copy.
    """
    temp_dir = tempfile.mkdtemp()
    base_name = os.path.basename(src_dir)
    dest_path = os.path.join(temp_dir, base_name)
    
    def ignore_patterns(directory, files):
        return [f for f in files if f in excludes]
    
    shutil.copytree(src_dir, dest_path, ignore=ignore_patterns)
    return dest_path

# =============================================================================
# Load Infrastructure Configuration from YAML
# =============================================================================

parser = argparse.ArgumentParser(description="Deploy Geod on Grid5000")
parser.add_argument(
    "-c", "--config",
    default=DEFAULT_INFRA_YAML,
    help=f"Path to infra YAML config (default: {DEFAULT_INFRA_YAML})"
)
args = parser.parse_args()

with open(args.config, "r") as f:
    infra_config = yaml.safe_load(f)

JOB_NAME = infra_config.get("job_name", "geod-full-stack")
WALLTIME = infra_config.get("walltime", "02:00:00")
machines = infra_config.get("machines", [])

if not machines:
    print("Error: No machines defined in infra.yaml")
    exit(1)

# =============================================================================
# Setup
# =============================================================================

en.init_logging(level=logging.INFO)
en.check()

# =============================================================================
# Infrastructure Definition (built dynamically from infra.yaml)
# =============================================================================

print("\n" + "=" * 60)
print("GEOD FULL STACK DEPLOYMENT")
print("=" * 60)
print(f"  Config: {args.config}")
print(f"  Job:    {JOB_NAME} ({WALLTIME})")
print(f"  Machines: {len(machines)} groups")

conf = en.G5kConf.from_settings(
    job_type=[],
    job_name=JOB_NAME,
    walltime=WALLTIME,
)

for machine in machines:
    conf.add_machine(
        roles=machine["roles"],
        cluster=machine["cluster"],
        nodes=machine.get("nodes", 1),
        site=machine["site"],
    )
    print(f"    - {machine['cluster']}/{machine['site']}: "
          f"{machine.get('nodes', 1)} node(s), roles={machine['roles']}")

# =============================================================================
# Reserve Nodes
# =============================================================================

print("\n[1/7] Reserving nodes...")
provider = en.G5k(conf)
roles, networks = provider.init()

manager_node = roles["manager"][0]
agent_nodes = roles["agent"]

# Get IP for manager node
try:
    manager_ip = socket.gethostbyname(manager_node.address)
except socket.gaierror:
    manager_ip = manager_node.address

# Use hostname for better compatibility (agents will resolve via DNS)
backend_url = f"http://{manager_node.address}:{BACKEND_PORT}"

print(f"  Manager node: {manager_node.address} ({manager_ip})")
print(f"  Agent nodes: {[n.address for n in agent_nodes]}")

# =============================================================================
# Prepare Clean Copies (excluding venv, node_modules, etc.)
# =============================================================================

print("\n[2/7] Preparing clean copies (excluding venv, node_modules)...")

backend_clean = copy_dir_excluding(BACKEND_DIR, "", EXCLUDED_DIRS)
frontend_clean = copy_dir_excluding(FRONTEND_DIR, "", EXCLUDED_DIRS)
agent_clean = copy_dir_excluding(AGENT_DIR, "", EXCLUDED_DIRS)

print(f"  Created temporary clean copies")

try:
    # =============================================================================
    # Deploy Backend
    # =============================================================================

    print(f"\n[3/7] Deploying backend...")

    with en.actions(roles=roles["backend"]) as a:
        a.copy(src=backend_clean, dest="~")

    print("\n[4/7] Installing backend dependencies...")

    with en.actions(roles=roles["backend"]) as a:
        a.shell("sudo apt-get update && sudo apt-get install -y python3-pip")
        a.shell(f"sudo pip3 install -r {REMOTE_BACKEND_DIR}/requirements.txt")

    print("\n[5/7] Starting backend + Prometheus...")

    # Create prometheus config with correct backend address
    # Generate agent targets dynamically
    agent_targets = ", ".join([f"'{n.address}:8000'" for n in agent_nodes])
    
    prometheus_config_content = f"""global:
  scrape_interval: 5s

scrape_configs:
  - job_name: 'geod-backend'
    scrape_interval: 5s
    static_configs:
      - targets: ['localhost:{BACKEND_PORT}']

  - job_name: 'geod-agents'
    scrape_interval: 5s
    static_configs:
      - targets: [{agent_targets}]
"""

    with en.actions(roles=roles["backend"]) as a:
        # Start backend
        a.shell(
            f"cd {REMOTE_BACKEND_DIR} && "
            f"nohup python3 app.py > backend.log 2>&1 &"
        )
        # Install and start Prometheus
        a.shell("sudo apt-get install -y prometheus || true")
        a.shell(f"echo '{prometheus_config_content}' > ~/prometheus.yml")
        a.shell(
            f"nohup prometheus --config.file=~/prometheus.yml "
            f"--web.listen-address=':{PROMETHEUS_PORT}' > ~/prometheus.log 2>&1 &"
        )

    print("  Waiting for services to start...")
    time.sleep(5)

    # =============================================================================
    # Deploy Frontend
    # =============================================================================

    print(f"\n[6/7] Deploying frontend...")

    with en.actions(roles=roles["frontend"]) as a:
        a.copy(src=frontend_clean, dest="~")

    print("\n  Installing frontend dependencies...")

    with en.actions(roles=roles["frontend"]) as a:
        # Install Node.js
        a.shell(
            "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && "
            "sudo apt-get install -y nodejs"
        )
        a.shell(f"cd {REMOTE_FRONTEND_DIR} && npm install")

    print("\n  Starting frontend dev server...")

    with en.actions(roles=roles["frontend"], gather_facts=False, on_error_continue=True) as a:
        # Use setsid to properly detach the process from the Ansible session
        # nohup alone doesn't prevent Ansible from killing background processes
        a.shell(
            f"cd {REMOTE_FRONTEND_DIR} && "
            f"echo 'VITE_BACKEND_URL={backend_url}' > .env && "
            f"setsid sh -c 'npm run dev -- --host 0.0.0.0 > frontend.log 2>&1' &"
        )
    
    # Wait for frontend to start
    print("  Waiting for frontend to start...")
    time.sleep(10)


    # =============================================================================
    # Deploy Agents
    # =============================================================================

    print(f"\n[7/7] Deploying agents...")

    with en.actions(roles=roles["agent"]) as a:
        a.copy(src=agent_clean, dest="~")

    with en.actions(roles=roles["agent"]) as a:
        a.shell("sudo apt-get update && sudo apt-get install -y python3-pip")
        a.shell(f"sudo pip3 install -r {REMOTE_AGENT_DIR}/requirements.txt")

    print(f"  Starting agents with backend URL: {backend_url}")

    with en.actions(roles=roles["agent"]) as a:
        a.shell(
            f"nohup sudo python3 {REMOTE_AGENT_DIR}/agent.py "
            f"--backend {backend_url} > {REMOTE_AGENT_DIR}/agent.log 2>&1 &"
        )

    # =============================================================================
    # Push Topology Configuration
    # =============================================================================

    print(f"\n[8/8] Pushing topology configuration...")
    time.sleep(10)  # Wait for agents to register

    try:
        topology_links = []
        if 'topology' in infra_config and 'links' in infra_config['topology']:
            topology_links = infra_config['topology']['links']

        if topology_links:
            # Build name → real hostname mapping from enoslib roles.
            # Topology names follow the pattern: "role" or "agent-site-N"
            # e.g., "manager" → manager_node.address
            #        "agent-nantes-1" → roles["nantes"][0].address
            #        "agent-rennes-1" → roles["rennes"][0].address
            name_to_hostname = {}

            # Map "manager" to real hostname
            name_to_hostname["manager"] = manager_node.address

            # Map site-based agent names: "agent-{site}-{N}"
            site_roles = {}
            for role_name, role_nodes in roles.items():
                if role_name not in ("manager", "backend", "frontend", "prometheus", "agent"):
                    site_roles[role_name] = role_nodes

            for site_name, site_nodes in site_roles.items():
                for i, node in enumerate(site_nodes, start=1):
                    friendly_name = f"agent-{site_name}-{i}"
                    name_to_hostname[friendly_name] = node.address

            print(f"  Hostname mapping:")
            for friendly, real in name_to_hostname.items():
                print(f"    {friendly} → {real}")

            # Resolve topology links: replace friendly names with real hostnames
            resolved_links = []
            for link in topology_links:
                src = link.get('src', '')
                dst = link.get('dst', '')
                resolved_src = name_to_hostname.get(src, src)
                resolved_dst = name_to_hostname.get(dst, dst)
                resolved_link = {**link, 'src': resolved_src, 'dst': resolved_dst}
                resolved_links.append(resolved_link)

            # Push topology from the manager node itself (avoids local DNS issues)
            import json
            payload = json.dumps({"links": resolved_links})
            # Escape single quotes in payload for shell
            escaped_payload = payload.replace("'", "'\\''")

            with en.actions(roles=roles["manager"]) as a:
                a.shell(
                    f"curl -s -X POST http://localhost:{BACKEND_PORT}/api/topology/config "
                    f"-H 'Content-Type: application/json' "
                    f"-d '{escaped_payload}'"
                )

            print(f"  ✅ Topology config pushed from manager node: {len(resolved_links)} links defined")
        else:
            print("  ⚠️  No topology links found in infra.yaml")
    except Exception as e:
        print(f"  ⚠️  Error pushing topology: {e}")

finally:
    # =============================================================================
    # Cleanup Temporary Directories
    # =============================================================================
    print("\n  Cleaning up temporary files...")
    for temp_path in [backend_clean, frontend_clean, agent_clean]:
        parent_dir = os.path.dirname(temp_path)
        if os.path.exists(parent_dir):
            shutil.rmtree(parent_dir)

# =============================================================================
# Output Connection Info
# =============================================================================

print("\n" + "=" * 60)
print("DEPLOYMENT SUCCESSFUL!")
print("=" * 60)

print(f"""
MANAGER NODE (all services)
---------------------------
  Address:    {manager_node.address}
  Backend:    http://{manager_node.address}:{BACKEND_PORT}
  Frontend:   http://{manager_node.address}:{FRONTEND_PORT}
  Prometheus: http://{manager_node.address}:{PROMETHEUS_PORT}

AGENTS ({len(agent_nodes)} nodes)
------""")

for node in agent_nodes:
    print(f"  - {node.address}")

# Determine the manager site for the SSH tunnel
manager_site = next(
    (m["site"] for m in machines if "manager" in m["roles"]),
    "nantes"
)

print(f"""
SSH TUNNEL (run from your local machine)
----------------------------------------
# Access all services locally (single tunnel to manager):
ssh -L {BACKEND_PORT}:{manager_node.address}:{BACKEND_PORT} \\
    -L {FRONTEND_PORT}:{manager_node.address}:{FRONTEND_PORT} \\
    -L {PROMETHEUS_PORT}:{manager_node.address}:{PROMETHEUS_PORT} \\
    -J <your_user>@access.grid5000.fr \\
    <your_user>@f{manager_site}.grid5000.fr

Then open in browser:
  - Frontend:   http://localhost:{FRONTEND_PORT}
  - Prometheus: http://localhost:{PROMETHEUS_PORT}
""")

print("=" * 60)

