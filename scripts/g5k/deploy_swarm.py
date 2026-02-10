#!/usr/bin/env python3
"""
GeoD Chaos Engineering - Grid5000 Swarm Deployment
Deploys a Docker Swarm cluster on Grid5000 and runs chaos engineering tests.

Prerequisites:
    pip install enoslib

Configuration:
    Create ~/.python-grid5000.yaml with:
        username: YOUR_LOGIN
        password: YOUR_PASSWORD
    chmod 600 ~/.python-grid5000.yaml
"""

import enoslib as en
import logging
import time
import json
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent.parent
SWARM_COMPOSE = PROJECT_ROOT / "infra" / "swarm" / "docker-compose.chaos.yml"


def run_shell(roles, cmd, **kwargs):
    """Run a shell command using Ansible shell module (avoids Jinja2 templating issues)."""
    with en.actions(roles=roles, **kwargs) as a:
        a.shell(cmd)
    return a.results


def deploy_swarm_cluster(site: str = "rennes", cluster: str = "parasilo",
                         nodes: int = 3, walltime: str = "1:00:00", no_deploy: bool = False):
    """Deploy a Docker Swarm cluster on Grid5000."""

    en.init_logging()

    logger.info(f"Reserving {nodes} nodes on {site}/{cluster}")

    if no_deploy:
        logger.info("Using default environment (no OS deployment)")
        conf = (
            en.G5kConf.from_settings(
                job_name="geod-chaos",
                walltime=walltime
            )
            .add_machine(roles=["manager"], cluster=cluster, nodes=1)
            .add_machine(roles=["worker"], cluster=cluster, nodes=nodes - 1)
            .finalize()
        )
    else:
        conf = (
            en.G5kConf.from_settings(
                job_name="geod-chaos",
                job_type=["deploy"],
                env_name="debian11-base",
                walltime=walltime
            )
            .add_machine(roles=["manager"], cluster=cluster, nodes=1)
            .add_machine(roles=["worker"], cluster=cluster, nodes=nodes - 1)
            .finalize()
        )

    provider = en.G5k(conf)
    roles, networks = provider.init()

    if not roles.get("manager") or not roles.get("worker"):
        raise Exception(f"Deployment failed: got {len(roles.get('manager', []))} manager(s) and {len(roles.get('worker', []))} worker(s). Try another site/cluster.")

    logger.info(f"Got {len(roles['manager'])} manager(s) and {len(roles['worker'])} worker(s)")

    logger.info("Installing Docker with Swarm mode...")
    registry_opts = dict(type="external", ip="docker-cache.grid5000.fr", port=80)
    docker = en.Docker(
        agent=roles["manager"] + roles["worker"],
        bind_var_docker="/tmp/docker",
        registry_opts=registry_opts,
        swarm=True
    )
    docker.deploy()

    return provider, roles, networks


def build_and_push_images(roles, git_repo: str = None, git_branch: str = "main"):
    """Build GeoD images on the manager node."""

    logger.info("Preparing project files on manager...")

    if git_repo:
        logger.info(f"Cloning from {git_repo}...")
        en.run_command("apt-get update && apt-get install -y git", roles=roles["manager"])
        en.run_command(f"rm -rf /tmp/geod && git clone -b {git_branch} {git_repo} /tmp/geod",
                       roles=roles["manager"])
    else:
        logger.info("Creating project structure from local files...")
        en.run_command("mkdir -p /tmp/geod/backend /tmp/geod/agent /tmp/geod/infra/swarm /tmp/geod/infra/demo-webapp",
                       roles=roles["manager"])

        files_to_copy = [
            ("backend", ["app.py", "requirements.txt", "Dockerfile", "config", "application", "domain", "infrastructure"]),
            ("agent", ["agent.py", "tc_manager.py", "docker_discovery.py", "ns_tc_manager.py", "requirements.txt", "Dockerfile"]),
            ("infra/swarm", ["docker-compose.chaos.yml", "prometheus.yml"]),
            ("infra/demo-webapp", ["app.py", "Dockerfile", "requirements.txt"]),
        ]

        with en.actions(roles=roles["manager"]) as a:
            for base_dir, items in files_to_copy:
                for item in items:
                    src_path = PROJECT_ROOT / base_dir / item
                    if src_path.exists():
                        if src_path.is_file():
                            a.copy(src=str(src_path), dest=f"/tmp/geod/{base_dir}/{item}")
                        else:
                            a.copy(src=str(src_path) + "/", dest=f"/tmp/geod/{base_dir}/{item}/")

    logger.info("Building images on manager...")
    build_cmds = [
        "cd /tmp/geod && docker build -t geod-backend:latest backend",
        "cd /tmp/geod && docker build -t geod-agent:latest agent",
        "cd /tmp/geod && docker build -t geod-demo-webapp:latest infra/demo-webapp",
    ]
    for cmd in build_cmds:
        run_shell(roles["manager"], cmd)
        logger.info(f"Built: {cmd.split()[-1]}")


def deploy_stack(roles):
    """Deploy the GeoD chaos stack."""

    logger.info("Deploying GeoD chaos stack...")

    run_shell(roles["manager"],
              "cd /tmp/geod/infra/swarm && docker stack deploy -c docker-compose.chaos.yml geod-chaos")

    logger.info("Waiting for services to start (30s)...")
    time.sleep(30)

    results = run_shell(roles["manager"], "docker stack services geod-chaos")
    for r in results:
        if r.status == "OK" and r.payload.get("stdout"):
            logger.info(f"Stack status:\n{r.payload['stdout']}")


def wait_for_services(roles, max_wait: int = 120):
    """Wait for all services to be ready."""
    logger.info("Waiting for all services to be ready...")

    start = time.time()
    while time.time() - start < max_wait:
        try:
            results = run_shell(roles["manager"],
                               "docker stack services geod-chaos")
            for r in results:
                if r.status == "OK":
                    output = r.payload.get("stdout", "")
                    logger.debug(f"Services: {output}")

                    lines = output.strip().split("\n")[1:]
                    all_ready = True
                    for line in lines:
                        if line.strip():
                            # Parse "REPLICAS" column (format: "1/1" or "0/1")
                            # Column positions vary, look for X/Y pattern
                            import re
                            match = re.search(r'(\d+)/(\d+)', line)
                            if match:
                                current, desired = match.groups()
                                if current != desired or current == "0":
                                    all_ready = False
                                    break

                    if all_ready and lines:
                        logger.info("All services are ready!")
                        return True
        except Exception as e:
            logger.debug(f"Check failed: {e}")

        time.sleep(5)

    logger.warning(f"Timeout waiting for services after {max_wait}s")
    return False


def get_service_info(roles):
    """Get information about running services."""

    results = run_shell(roles["manager"], "docker service ls")
    for r in results:
        if r.status == "OK":
            logger.info(f"Services:\n{r.payload.get('stdout', '')}")

    try:
        results = run_shell(roles["manager"], "curl -s http://localhost:5001/api/agents")
        for r in results:
            if r.status == "OK":
                stdout = r.payload.get("stdout", "[]")
                agents = json.loads(stdout)
                logger.info(f"Connected agents: {len(agents)}")
                return agents
    except Exception as e:
        logger.warning(f"Could not get agents: {e}")

    return []


def get_container_id(roles, filter_name: str):
    """Get container ID by name filter."""
    try:
        results = run_shell(roles["manager"],
                           f"docker ps --filter 'name={filter_name}' --format '{{{{.ID}}}}'")
        for r in results:
            if r.status == "OK":
                return r.payload.get("stdout", "").strip()
    except Exception as e:
        logger.warning(f"Could not get container ID: {e}")
    return None


def run_chaos_test(roles, agent_hostname: str, container_id: str, latency_ms: int = 200):
    """Run a chaos engineering test."""

    logger.info(f"Injecting {latency_ms}ms latency on container {container_id[:12]}...")

    inject_cmd = (
        f'curl -s -X POST http://localhost:5001/api/chaos/external/{agent_hostname} '
        f'-H "Content-Type: application/json" '
        f'-d \'{{"container_id": "{container_id}", "rules": [{{"effects": {{"latency": "{latency_ms}ms"}}}}]}}\''
    )
    run_shell(roles["manager"], inject_cmd)

    time.sleep(3)

    logger.info("Measuring latency with chaos...")
    latencies = []
    for i in range(5):
        try:
            results = run_shell(roles["manager"], "curl -s http://localhost:8080/ping-redis")
            for r in results:
                if r.status == "OK":
                    data = json.loads(r.payload.get("stdout", "{}"))
                    lat = data.get("latency_ms", 0)
                    latencies.append(lat)
                    logger.info(f"  Measurement {i+1}: {lat:.2f}ms")
        except Exception as e:
            logger.warning(f"  Measurement {i+1} failed: {e}")
        time.sleep(0.5)

    if latencies:
        avg_latency = sum(latencies) / len(latencies)
        logger.info(f"Average latency with chaos: {avg_latency:.2f}ms")
    else:
        avg_latency = 0
        logger.warning("No latency measurements collected")

    logger.info("Clearing chaos...")
    clear_cmd = f"curl -s -X DELETE http://localhost:5001/api/chaos/external/{agent_hostname}/{container_id}"
    run_shell(roles["manager"], clear_cmd)

    time.sleep(2)

    try:
        results = run_shell(roles["manager"], "curl -s http://localhost:8080/ping-redis")
        for r in results:
            if r.status == "OK":
                data = json.loads(r.payload.get("stdout", "{}"))
                logger.info(f"Latency after cleanup: {data.get('latency_ms', 0):.2f}ms")
    except Exception as e:
        logger.warning(f"Could not measure cleanup latency: {e}")

    return avg_latency


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Deploy GeoD on Grid5000 Swarm")
    parser.add_argument("--site", default="rennes", help="Grid5000 site")
    parser.add_argument("--cluster", default="parasilo", help="Cluster name")
    parser.add_argument("--nodes", type=int, default=3, help="Number of nodes")
    parser.add_argument("--walltime", default="1:00:00", help="Job duration")
    parser.add_argument("--skip-build", action="store_true", help="Skip image build")
    parser.add_argument("--skip-test", action="store_true", help="Skip chaos test")
    parser.add_argument("--git-repo", help="Git repository URL to clone (recommended)")
    parser.add_argument("--git-branch", default="main", help="Git branch to use")
    parser.add_argument("--no-deploy", action="store_true", help="Skip OS deployment (use default environment)")
    args = parser.parse_args()

    provider = None
    try:
        provider, roles, networks = deploy_swarm_cluster(
            site=args.site,
            cluster=args.cluster,
            nodes=args.nodes,
            walltime=args.walltime,
            no_deploy=args.no_deploy
        )

        if not args.skip_build:
            build_and_push_images(roles, git_repo=args.git_repo, git_branch=args.git_branch)

        deploy_stack(roles)
        wait_for_services(roles)

        agents = get_service_info(roles)

        if not args.skip_test and agents:
            webapp_id = get_container_id(roles["manager"], "webapp")

            if webapp_id and len(agents) > 0:
                agent = agents[-1]
                logger.info(f"\n{'='*50}")
                logger.info("Running chaos engineering test...")
                logger.info(f"{'='*50}")
                run_chaos_test(roles, agent["hostname"], webapp_id, latency_ms=300)

        manager_ip = roles["manager"][0].address
        logger.info(f"\n{'='*50}")
        logger.info("DEPLOYMENT COMPLETE!")
        logger.info(f"{'='*50}")
        logger.info(f"Manager: {manager_ip}")
        logger.info(f"Backend: http://{manager_ip}:5001")
        logger.info(f"Webapp:  http://{manager_ip}:8080")
        logger.info(f"Prometheus: http://{manager_ip}:9090")
        logger.info("")
        logger.info("SSH: ssh root@access.grid5000.fr")
        logger.info(f"     ssh root@{manager_ip.split('.')[0]}")
        logger.info("")
        logger.info("Press Ctrl+C to destroy the cluster...")

        while True:
            time.sleep(60)

    except KeyboardInterrupt:
        logger.info("\nShutting down...")
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if provider:
            logger.info("Destroying cluster...")
            provider.destroy()


if __name__ == "__main__":
    main()
