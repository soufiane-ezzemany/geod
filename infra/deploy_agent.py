import logging
import socket
import enoslib as en
import os

# 1. Setup Logging
en.init_logging(level=logging.INFO)
en.check()

# 2. Define the Infrastructure
conf = (
    en.G5kConf.from_settings(job_name="geod-agent-deploy", walltime="01:00:00")
    .add_machine(roles=["agent"], cluster="ecotype", nodes=2, site="nantes")
)

# 3. Reserve the nodes
provider = en.G5k(conf)
roles, networks = provider.init()

# 4. Deploy Agent Code
local_agent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "agent"))
remote_agent_dir = "~/agent"

print(f"\nDeploying agent code from '{local_agent_dir}' to nodes...")

with en.actions(roles=roles["agent"]) as a:
    a.copy(src=local_agent_dir, dest="~")

# 5. Install Dependencies
print("\nInstalling Python dependencies on nodes...")

with en.actions(roles=roles["agent"]) as a:
    # Install pip if not available
    a.shell("sudo apt-get update && sudo apt-get install -y python3-pip")
    # Install requirements
    a.shell(f"sudo pip3 install -r {remote_agent_dir}/requirements.txt")

# 6. Execute Agent on Each Node
backend_url = "https://hee-nonsymbiotical-abiotically.ngrok-free.dev"
print(f"\nStarting agent on each node with backend URL: {backend_url}")

with en.actions(roles=roles["agent"]) as a:
    # Run agent in background using nohup
    a.shell(
        f"nohup sudo python3 {remote_agent_dir}/agent.py --backend {backend_url} > {remote_agent_dir}/agent.log 2>&1 &"
    )

# 7. Output connection info

print("\n" + "="*30)
print(f"DEPLOYMENT SUCCESSFUL!")
print("Agent code deployed to:\n")

for node in roles["agent"]:
    try:
        node_ip = socket.gethostbyname(node.address)
    except socket.gaierror:
        node_ip = "Unknown IP (DNS resolution failed)"
        
    print(f" - {node.alias}")
    print(f"   Path: {remote_agent_dir}")
    print("   To verify, you can SSH into a node:")
    print(f"   ssh root@{node.alias} 'ls -R {remote_agent_dir}'")
    print("\n")


