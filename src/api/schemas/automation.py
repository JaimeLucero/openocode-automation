"""Automation schemas for API."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class AutomationStartRequest(BaseModel):
    """Request to start automation."""

    project_dir: str
    project_context: str = ""
    planner_model: str = "kimi-k2.5"
    builder_model: str = "kimi-k2.5"
    tester_model: str = "kimi-k2.5"
    telegram_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None


class AutomationStatusResponse(BaseModel):
    """Automation status response."""

    session_id: int
    running: bool
    paused: bool
    phase: str
    progress: dict


class AutomationInputRequest(BaseModel):
    """User input request."""

    message: str


class AutomationResponse(BaseModel):
    """Generic automation response."""

    success: bool
    message: str = ""
    data: Optional[dict] = None


class PhaseTransitionRequest(BaseModel):
    """Request to transition phase."""

    phase: str
    force: bool = False
