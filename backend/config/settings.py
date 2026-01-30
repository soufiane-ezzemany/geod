"""Application configuration settings.

Centralizes all configuration constants to replace magic numbers.
"""

import os


# Application Configuration
SECRET_KEY = 'geod-secret-key'
DEBUG = True
HOST = '0.0.0.0'
PORT = 5000

# CORS Configuration
CORS_ALLOWED_ORIGINS = "*"

# Monitoring Configuration
MONITOR_INTERVAL_SECONDS = 15
PING_COUNT = 3
HEARTBEAT_TIMEOUT_SECONDS = 60
PING_STAGGER_DELAY_SECONDS = 0.1

# Prometheus Configuration
PROMETHEUS_URL = os.environ.get('PROMETHEUS_URL', 'http://prometheus:9090')
RATE_WINDOW_MIN_SECONDS = 60
RATE_WINDOW_MULTIPLIER = 4

# History Configuration
DEFAULT_STEP = '15s'
