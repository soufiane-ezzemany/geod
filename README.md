# Geod

Geod is built with a Flask backend, a React frontend, a Python agent, and deployment/infrastructure tools. The [`backend/`](./backend/Readme.md) directory contains the Flask API server built with Python, the [`frontend/`](./frontend/README.md) directory contains the React application built with TypeScript and Vite, the [`agent/`](./agent/README.md) directory contains the Python agent for network monitoring and manipulation, and the [`infra/`](./infra/README.md) directory contains deployment scripts and infrastructure automation.

## Getting Started

To run the application, you'll need to set up the backend, frontend, and at least oneagent. Start by following the instructions in [`backend/Readme.md`](./backend/Readme.md), [`frontend/README.md`](./frontend/README.md), and [`agent/README.md`](./agent/README.md) for each respective directory.

## Development

For full functionality, make sure the backend, frontend, and at least one agent are all running simultaneously. For a full setup using Docker compose:

```bash
cd infra/
docker-compose up --build
```
This will build and start all components of the application. Access the frontend at `http://localhost:5173/`, and the backend API will be available at `http://localhost:5000/`.
