"""Application configuration settings.

Centralizes all configuration constants to replace magic numbers.
"""

# Application Configuration
SECRET_KEY = 'geod-secret-key'

# CORS Configuration
CORS_ALLOWED_ORIGINS = "*"

# Monitoring Configuration
MONITOR_INTERVAL_SECONDS = 15
PING_COUNT = 3
PING_STAGGER_DELAY_SECONDS = 0.1
