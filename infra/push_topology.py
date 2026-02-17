#!/usr/bin/env python3
"""
Push Topology Configuration to Geod Backend.

Reads a topology YAML file and POSTs the link definitions to the backend.
Can be re-run anytime to dynamically update the topology without restarts.

Usage:
    python push_topology.py --backend http://localhost:5001 --file topology.yaml
    python push_topology.py -b http://localhost:5001 -f topology.yaml

The backend will broadcast the new topology to all connected frontends instantly.
"""

import argparse
import json
import sys
import time

import requests
import yaml


def load_topology(file_path: str) -> list:
    """Load topology link definitions from a YAML file."""
    with open(file_path, 'r') as f:
        data = yaml.safe_load(f)

    # Support both top-level 'topology.links' and direct 'links' key
    if 'topology' in data and 'links' in data['topology']:
        return data['topology']['links']
    elif 'links' in data:
        return data['links']
    else:
        print("Error: YAML file must contain 'topology.links' or 'links' key")
        sys.exit(1)


def wait_for_backend(backend_url: str, timeout: int = 30):
    """Wait for the backend to be available."""
    print(f"Waiting for backend at {backend_url}...", end="", flush=True)
    start = time.time()
    while time.time() - start < timeout:
        try:
            resp = requests.get(f"{backend_url}/api/topology", timeout=3)
            if resp.status_code == 200:
                print(" OK")
                return True
        except requests.ConnectionError:
            pass
        print(".", end="", flush=True)
        time.sleep(2)

    print(" TIMEOUT")
    return False


def push_topology(backend_url: str, links: list):
    """Push topology config to the backend."""
    url = f"{backend_url}/api/topology/config"
    payload = {"links": links}

    print(f"\nPushing {len(links)} link definitions to {url}...")
    print(f"Links:")
    for link in links:
        src = link.get('src', '?')
        dst = link.get('dst', '?')
        delay = link.get('delay', 'none')
        rate = link.get('rate', 'none')
        sym = '↔' if link.get('symmetric', True) else '→'
        print(f"  {src} {sym} {dst}  (delay={delay}, rate={rate})")

    try:
        resp = requests.post(url, json=payload, timeout=10)
        result = resp.json()

        if resp.status_code == 200:
            print(f"\n✅ Success: {result.get('message', 'Topology config applied')}")
            print(f"   Links defined: {result.get('links_defined', len(links))}")
        else:
            print(f"\n❌ Error: {result.get('error', 'Unknown error')}")
            sys.exit(1)
    except requests.ConnectionError:
        print(f"\n❌ Error: Cannot connect to backend at {backend_url}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Push topology configuration to Geod backend"
    )
    parser.add_argument(
        '-b', '--backend',
        default='http://localhost:5001',
        help='Backend URL (default: http://localhost:5001)'
    )
    parser.add_argument(
        '-f', '--file',
        default='topology.yaml',
        help='Topology YAML file (default: topology.yaml)'
    )
    parser.add_argument(
        '--no-wait',
        action='store_true',
        help='Skip waiting for backend to be available'
    )

    args = parser.parse_args()

    # Load topology
    links = load_topology(args.file)

    # Wait for backend
    if not args.no_wait:
        if not wait_for_backend(args.backend):
            print("Backend not available, exiting.")
            sys.exit(1)

    # Push topology
    push_topology(args.backend, links)


if __name__ == '__main__':
    main()
