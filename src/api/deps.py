"""API dependencies."""

from typing import Annotated, Optional

from fastapi import Depends, Header, HTTPException

from services.database import Database, get_db
from config import get_settings


async def get_database() -> Database:
    """Get database dependency."""
    return get_db()


async def verify_api_key(x_api_key: Annotated[Optional[str], Header()] = None) -> str:
    """Verify API key for authenticated endpoints."""
    settings = get_settings()

    if settings.opencode_api_key and x_api_key != settings.opencode_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")

    return x_api_key
