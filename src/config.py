"""Configuration settings for OpenCode Orchestrator."""

import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings."""

    # Neon Database
    neon_connection_string: str = os.environ.get(
        "NEON_CONNECTION_STRING", "postgresql://user:pass@localhost/opencode"
    )

    # FastAPI
    host: str = "0.0.0.0"
    port: int = 8000

    # Agents
    opencode_api_key: Optional[str] = os.environ.get("OPENCODE_API_KEY")
    planner_model: str = "kimi-k2.5"
    builder_model: str = "kimi-k2.5"
    tester_model: str = "kimi-k2.5"

    # Notification
    telegram_bot_token: Optional[str] = os.environ.get("TELEGRAM_BOT_TOKEN")
    telegram_chat_id: Optional[str] = os.environ.get("TELEGRAM_CHAT_ID")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
