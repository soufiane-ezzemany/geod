"""Application configuration settings."""

SECRET_KEY = 'geod-secret-key'

# Allow ALL origins (required for dynamic Grid5000 hosts)
# Use "*" string for Flask-SocketIO compatibility
CORS_ALLOWED_ORIGINS = "*"

MONITOR_INTERVAL_SECONDS = 15
PING_COUNT = 3
PING_STAGGER_DELAY_SECONDS = 0.1

