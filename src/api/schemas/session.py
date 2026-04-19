"""Session schemas for API."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    """Session creation request."""

    project_dir: str
    project_name: str
    planner_model: str = "kimi-k2.5"
    builder_model: str = "kimi-k2.5"
    tester_model: str = "kimi-k2.5"


class SessionUpdate(BaseModel):
    """Session update request."""

    phase: Optional[str] = None
    status: Optional[str] = None


class SessionResponse(BaseModel):
    """Session response."""

    id: int
    project_dir: str
    project_name: str
    phase: str
    status: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SessionListResponse(BaseModel):
    """Session list response."""

    sessions: List[SessionResponse]
    total: int
