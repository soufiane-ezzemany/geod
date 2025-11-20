# Geod

Geod is built with a Flask backend, a React frontend, a Python agent, and deployment/infrastructure tools. The [`backend/`](./backend/Readme.md) directory contains the Flask API server built with Python, the [`frontend/`](./frontend/README.md) directory contains the React application built with TypeScript and Vite, the [`agent/`](./agent/README.md) directory contains the Python agent for network monitoring and manipulation, and the [`infra/`](./infra/README.md) directory contains deployment scripts and infrastructure automation.

## Getting Started

To run the application, you'll need to set up the backend, frontend, and at least oneagent. Start by following the instructions in [`backend/Readme.md`](./backend/Readme.md), [`frontend/README.md`](./frontend/README.md), and [`agent/README.md`](./agent/README.md) for each respective directory.

## Development

For full functionality, make sure the backend, frontend, and at least one agent are all running simultaneously.

## API Endpoints

### `GET /`

- **Description**: Returns a simple message indicating the backend is running.
- **Response**:
  ```json
  "Network Monitoring Backend"
  ```

### `GET /api/agents`

- **Description**: Retrieves a list of all connected agents.
- **Response**:
  ```json
  [
    {
      "agent_id": "string",
      "hostname": "string",
      "ip_address": "string",
      "connected_at": "ISO8601 timestamp",
      "last_heartbeat": "ISO8601 timestamp"
    }
  ]
  ```

### `GET /api/agents/<agent_id>`

- **Description**: Retrieves details of a specific agent.
- **Response**:
  ```json
  {
    "agent_id": "string",
    "hostname": "string",
    "ip_address": "string",
    "os": "string",
    "connected_at": "ISO8601 timestamp",
    "last_heartbeat": "ISO8601 timestamp"
  }
  ```

## WebSocket Exchanges

### Events from Backend to Agent

#### `connected`

- **Source**: Backend
- **Description**: Sent when an agent connects to the backend.
- **Payload**:
  ```json
  {
    "message": "Connected to backend"
  }
  ```

#### `registration_confirmed`

- **Source**: Backend
- **Description**: Sent to confirm agent registration.
- **Payload**:
  ```json
  {
    "agent_id": "string",
    "status": "registered"
  }
  ```

#### `heartbeat_ack`

- **Source**: Backend
- **Description**: Acknowledges receipt of a heartbeat from the agent.
- **Payload**:
  ```json
  {
    "timestamp": "ISO8601 timestamp"
  }
  ```

#### `network_stats_update`

- **Source**: Backend
- **Description**: Broadcasts updated network statistics to all clients.
- **Payload**:
  ```json
  {
    "agent_id": "string",
    "stats": {
      "bytes_sent": "number",
      "bytes_recv": "number",
      "packets_sent": "number",
      "packets_recv": "number",
      "errors_in": "number",
      "errors_out": "number",
      "drop_in": "number",
      "drop_out": "number",
      "active_connections": "number",
      "interfaces": "object",
      "timestamp": "ISO8601 timestamp"
    },
    "timestamp": "ISO8601 timestamp"
  }
  ```

#### `command_result_update`

- **Source**: Backend
- **Description**: Broadcasts the result of a command executed by an agent.
- **Payload**:
  ```json
  {
    "agent_id": "string",
    "result": {
      "request_id": "string",
      "command": "string",
      "status": "success|failure",
      "data": "any",
      "error": "string|null",
      "timestamp": "ISO8601 timestamp"
    },
    "timestamp": "ISO8601 timestamp"
  }
  ```

#### `execute_command`

- **Source**: Backend
- **Description**: Sends a specific command to a targeted agent.
- **Payload**:
  ```json
  {
    "command": "string",
    "params": "object",
    "request_id": "string"
  }
  ```

### Events from Agent to Backend

#### `register_agent`

- **Source**: Agent
- **Description**: Registers the agent with the backend.
- **Payload**:
  ```json
  {
    "hostname": "string",
    "ip_address": "string",
    "os": "string",
    "os_version": "string",
    "platform": "string",
    "processor": "string"
  }
  ```

#### `heartbeat`

- **Source**: Agent
- **Description**: Sends a periodic heartbeat to the backend.
- **Payload**:
  ```json
  {}
  ```

#### `network_stats`

- **Source**: Agent
- **Description**: Sends network statistics to the backend.
- **Payload**:
  ```json
  {
    "bytes_sent": "number",
    "bytes_recv": "number",
    "packets_sent": "number",
    "packets_recv": "number",
    "errors_in": "number",
    "errors_out": "number",
    "drop_in": "number",
    "drop_out": "number",
    "active_connections": "number",
    "interfaces": "object",
    "timestamp": "ISO8601 timestamp"
  }
  ```

#### `command_result`

- **Source**: Agent
- **Description**: Sends the result of a command execution to the backend.
- **Payload**:
  ```json
  {
    "request_id": "string",
    "command": "string",
    "status": "success|failure",
    "data": "any",
    "error": "string|null",
    "timestamp": "ISO8601 timestamp"
  }
  ```
