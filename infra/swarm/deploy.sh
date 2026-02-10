#!/bin/bash

# =============================================================================
# Geod Docker Swarm Deployment Script
# =============================================================================

set -e

STACK_NAME="geod"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# Functions
# =============================================================================

init_swarm() {
    log_info "Initializing Docker Swarm..."
    if docker info 2>/dev/null | grep -q "Swarm: active"; then
        log_warn "Swarm already initialized"
    else
        docker swarm init
        log_info "Swarm initialized successfully"
    fi
}

build_images() {
    log_info "Building Docker images..."
    cd "$SCRIPT_DIR/../.."
    
    docker build -t geod-backend:latest ./backend
    docker build -t geod-frontend:latest ./frontend
    docker build -t geod-agent:latest ./agent
    
    log_info "All images built successfully"
}

deploy_stack() {
    log_info "Deploying stack '$STACK_NAME'..."
    cd "$SCRIPT_DIR"
    docker stack deploy -c docker-compose.swarm.yml "$STACK_NAME"
    log_info "Stack deployed successfully"
}

show_status() {
    log_info "Current services status:"
    docker service ls
    echo ""
    log_info "Service details:"
    docker stack ps "$STACK_NAME" --no-trunc
}

scale_agents() {
    local count=${1:-6}
    log_info "Scaling agents to $count replicas..."
    docker service scale "${STACK_NAME}_agent=$count"
}

remove_stack() {
    log_warn "Removing stack '$STACK_NAME'..."
    docker stack rm "$STACK_NAME"
    log_info "Stack removed"
}

show_logs() {
    local service=${1:-agent}
    log_info "Showing logs for ${STACK_NAME}_${service}..."
    docker service logs -f "${STACK_NAME}_${service}"
}

# =============================================================================
# Main
# =============================================================================

case "${1:-help}" in
    init)
        init_swarm
        ;;
    build)
        build_images
        ;;
    deploy)
        build_images
        deploy_stack
        sleep 5
        show_status
        ;;
    status)
        show_status
        ;;
    scale)
        scale_agents "$2"
        ;;
    logs)
        show_logs "$2"
        ;;
    stop)
        remove_stack
        ;;
    *)
        echo "Usage: $0 {init|build|deploy|status|scale <N>|logs <service>|stop}"
        echo ""
        echo "Commands:"
        echo "  init    - Initialize Docker Swarm mode"
        echo "  build   - Build all Docker images"
        echo "  deploy  - Build and deploy the stack"
        echo "  status  - Show current services status"
        echo "  scale N - Scale agent service to N replicas"
        echo "  logs X  - Follow logs for service X (default: agent)"
        echo "  stop    - Remove the stack"
        exit 1
        ;;
esac
