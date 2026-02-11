# GEOD Network Monitoring Agent

A Python agent for network monitoring and manipulation that communicates with the GEOD backend in real-time using WebSockets.

## Features

### Network Monitoring

**Real-time Network Statistics**: Continuously monitors and reports network I/O (bytes sent/received, packets, errors, drops)

**Interface Monitoring**: Tracks all network interfaces with their status, speed, MTU, and addresses

**Connection Tracking**: Lists all active network connections with source/destination IPs and ports

**System Metrics**: CPU usage, memory usage, and disk usage

### Network Operations

**Ping**: Test connectivity to remote hosts

**Bandwidth Limiting**: Set bandwidth limits on network interfaces (Linux only)

### Communication

**WebSocket Connection**: Real-time bidirectional communication with backend

**Auto-reconnection**: Automatically reconnects if connection is lost

**Heartbeat**: Periodic health checks to maintain connection

**Command Execution**: Receives and executes commands from backend

## Requirements

Python 3.8 or higher and root privileges (for network manipulation features).

## Installation

First create a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Then install dependencies:

```bash
pip install -r requirements.txt
```

## Usage

```bash
# Run agent with default settings (connects to localhost:5000)
sudo python agent.py # Root privileges required for network manipulation features
```

Command Line Options:

```
--backend, -b          Backend server URL (default: http://localhost:5000)
--stats-interval, -s   Stats reporting interval in seconds (default: 5)
--heartbeat-interval   Heartbeat interval in seconds (default: 10)
--no-reconnect         Disable automatic reconnection
--verbose, -v          Enable verbose logging
--help, -h             Show help message
```
