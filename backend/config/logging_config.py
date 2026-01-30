"""Logging configuration for the application."""

import logging
import sys


def setup_logging(level=logging.INFO, logger_name="Backend"):
    """Configure application logging.

    Args:
        level: Logging level (default: INFO)
        logger_name: Name of the logger (default: "Backend")

    Returns:
        Configured logger instance
    """
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler(sys.stdout)]
    )

    logger = logging.getLogger(logger_name)
    logger.setLevel(level)

    return logger
