#!/usr/bin/env python3
"""
Grid'5000 Full Infrastructure Deployment Script

Deploys:
- Backend (Flask+SocketIO) + Prometheus on one node
- Frontend (Vite) on another node  
- Agents on multiple nodes across sites

Usage:
    python deploy_infra.py
"""

import logging
import socket
import os
import time
import tempfile
import shutil
import enoslib as en

# =============================================================================
# Configuration
# =============================================================================

WALLTIME = "02:00:00"
JOB_NAME = "geod-full-stack"

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "backend"))
FRONTEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "frontend"))
AGENT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "agent"))
PROMETHEUS_CONFIG = os.path.abspath(os.path.join(SCRIPT_DIR, "prometheus.yml"))

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
# Setup
# =============================================================================

en.init_logging(level=logging.INFO)
en.check()

# =============================================================================
# Infrastructure Definition
# =============================================================================

print("\n" + "=" * 60)
print("GEOD FULL STACK DEPLOYMENT")
print("=" * 60)

conf = (
    en.G5kConf.from_settings(
        job_type=[],
        job_name=JOB_NAME,
        walltime=WALLTIME
    )
    # Backend + Prometheus node
    .add_machine(
        roles=["backend", "prometheus"],
        cluster="ecotype",
        nodes=1,
        site="nantes"
    )
    # Frontend node
    .add_machine(
        roles=["frontend"],
        cluster="ecotype",
        nodes=1,
        site="nantes"
    )
    # Agent nodes
    .add_machine(
        roles=["agent", "nantes"],
        cluster="ecotype",
        nodes=2,
        site="nantes"
    )
    .add_machine(
        roles=["agent", "rennes"],
        cluster="paradoxe",
        nodes=1,
        site="rennes"
    )
)

# =============================================================================
# Reserve Nodes
# =============================================================================

print("\n[1/8] Reserving nodes...")
provider = en.G5k(conf)
roles, networks = provider.init()

backend_node = roles["backend"][0]
frontend_node = roles["frontend"][0]
agent_nodes = roles["agent"]

# Get IPs
try:
    backend_ip = socket.gethostbyname(backend_node.address)
except socket.gaierror:
    backend_ip = backend_node.address

try:
    frontend_ip = socket.gethostbyname(frontend_node.address)
except socket.gaierror:
    frontend_ip = frontend_node.address

backend_url = f"http://{backend_ip}:{BACKEND_PORT}"

print(f"  Backend node: {backend_node.address} ({backend_ip})")
print(f"  Frontend node: {frontend_node.address} ({frontend_ip})")
print(f"  Agent nodes: {[n.address for n in agent_nodes]}")

# =============================================================================
# Prepare Clean Copies (excluding venv, node_modules, etc.)
# =============================================================================

print("\n[2/8] Preparing clean copies (excluding venv, node_modules)...")

backend_clean = copy_dir_excluding(BACKEND_DIR, "", EXCLUDED_DIRS)
frontend_clean = copy_dir_excluding(FRONTEND_DIR, "", EXCLUDED_DIRS)
agent_clean = copy_dir_excluding(AGENT_DIR, "", EXCLUDED_DIRS)

print(f"  Created temporary clean copies")

try:
    # =============================================================================
    # Deploy Backend
    # =============================================================================

    print(f"\n[3/8] Deploying backend...")

    with en.actions(roles=roles["backend"]) as a:
        a.copy(src=backend_clean, dest="~")

    print("\n[4/8] Installing backend dependencies...")

    with en.actions(roles=roles["backend"]) as a:
        a.shell("sudo apt-get update && sudo apt-get install -y python3-pip")
        a.shell(f"sudo pip3 install -r {REMOTE_BACKEND_DIR}/requirements.txt")

    print("\n[5/8] Starting backend + Prometheus...")

    # Create prometheus config with correct backend address
    prometheus_config_content = f"""global:
      scrape_interval: 5s

    scrape_configs:
      - job_name: 'geod-backend'
        scrape_interval: 5s
        static_configs:
          - targets: ['localhost:{BACKEND_PORT}']
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

    print(f"\n[6/8] Deploying frontend...")

    with en.actions(roles=roles["frontend"]) as a:
        a.copy(src=frontend_clean, dest="~")

    print("\n[7/8] Installing frontend dependencies...")

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

    print(f"\n[8/8] Deploying agents...")

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
SERVICES
--------
  Backend:    http://{backend_node.address}:{BACKEND_PORT}
  Frontend:   http://{frontend_node.address}:{FRONTEND_PORT}
  Prometheus: http://{backend_node.address}:{PROMETHEUS_PORT}

AGENTS ({len(agent_nodes)} nodes)
------""")

for node in agent_nodes:
    print(f"  - {node.address}")

print(f"""
SSH TUNNELS (run from your local machine)
-----------------------------------------
# Access all services locally:
ssh -L {BACKEND_PORT}:{backend_node.address}:{BACKEND_PORT} \\
    -L {FRONTEND_PORT}:{frontend_node.address}:{FRONTEND_PORT} \\
    -L {PROMETHEUS_PORT}:{backend_node.address}:{PROMETHEUS_PORT} \\
    -J <your_user>@access.grid5000.fr \\
    <your_user>@fnantes.grid5000.fr

Then open in browser:
  - Frontend:   http://localhost:{FRONTEND_PORT}
  - Prometheus: http://localhost:{PROMETHEUS_PORT}
""")

print("=" * 60)
