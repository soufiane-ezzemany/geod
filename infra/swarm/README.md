# Docker Swarm - Émulation Géodistribuée

Configuration Swarm pour **émuler une infrastructure géodistribuée** avec visualisation temps réel et contrôle réseau (tc/netem).

## Architecture

```
┌─────────────────────── SWARM OVERLAY NETWORK ───────────────────────┐
│                                                                      │
│   ┌──────────┐     ┌──────────┐     ┌──────────────┐               │
│   │ Frontend │     │ Backend  │     │  Prometheus  │               │
│   │  :5173   │────►│  :5001   │◄────│    :9090     │               │
│   └──────────┘     └────┬─────┘     └──────────────┘               │
│                         │                                           │
│         ┌───────────────┼───────────────┬───────────────┐          │
│         ▼               ▼               ▼               ▼          │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐       │
│   │  Paris   │   │ New York │   │  Tokyo   │   │  Sydney  │ ...   │
│   │ tc/netem │   │ tc/netem │   │ tc/netem │   │ tc/netem │       │
│   └──────────┘   └──────────┘   └──────────┘   └──────────┘       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
chmod +x deploy.sh

# Initialiser Swarm
./deploy.sh init

# Déployer
./deploy.sh deploy
```

## URLs

| Service    | URL                   |
| ---------- | --------------------- |
| Frontend   | http://localhost:5173 |
| Backend    | http://localhost:5001 |
| Prometheus | http://localhost:9090 |
| Visualizer | http://localhost:8080 |

## Agents Géodistribués

| Agent          | Région        | Variable d'env            |
| -------------- | ------------- | ------------------------- |
| agent-paris    | Europe        | `AGENT_LOCATION=paris`    |
| agent-newyork  | North America | `AGENT_LOCATION=newyork`  |
| agent-tokyo    | Asia          | `AGENT_LOCATION=tokyo`    |
| agent-sydney   | Oceania       | `AGENT_LOCATION=sydney`   |
| agent-saopaulo | South America | `AGENT_LOCATION=saopaulo` |

## Contrôle Réseau (tc/netem)

Chaque agent a les capabilities requises (`NET_ADMIN`, `privileged`) pour manipuler le trafic :

```bash
# Ajouter 100ms de latence sur un agent
docker exec <agent-container> tc qdisc add dev eth0 root netem delay 100ms

# Limiter la bande passante à 1Mbit/s
docker exec <agent-container> tc qdisc add dev eth0 root tbf rate 1mbit burst 32kbit latency 400ms

# Simuler 10% de perte de paquets
docker exec <agent-container> tc qdisc add dev eth0 root netem loss 10%
```

## Commandes

```bash
./deploy.sh init      # Initialiser Swarm
./deploy.sh deploy    # Déployer le stack
./deploy.sh status    # État des services
./deploy.sh logs X    # Logs d'un service
./deploy.sh stop      # Arrêter le stack
```
