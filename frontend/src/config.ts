// Backend API configuration
// Can be overridden via environment variable VITE_BACKEND_URL

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// API endpoints
export const API_ENDPOINTS = {
    agents: `${BACKEND_URL}/api/agents`,
    topology: `${BACKEND_URL}/api/topology`,
};
