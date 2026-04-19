"""Ticket schemas for API."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class TicketCreate(BaseModel):
    """Ticket creation request."""

    ticket_id: int
    title: str
    file_path: str = ""
    dependencies: List[int] = []
    steps: List[str] = []
    max_retries: int = 3


class TicketUpdate(BaseModel):
    """Ticket update request."""

    status: Optional[str] = None
    error: Optional[str] = None


class TicketResponse(BaseModel):
    """Ticket response."""

    id: int
    session_id: int
    ticket_id: int
    title: str
    file_path: str
    dependencies: List[int]
    steps: List[str]
    status: str
    retries: int
    max_retries: int
    error: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TicketListResponse(BaseModel):
    """Ticket list response."""

    tickets: List[TicketResponse]
    total: int
