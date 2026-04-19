"""Session API routes."""

from fastapi import APIRouter, HTTPException

from api.schemas.session import (
    SessionCreate,
    SessionUpdate,
    SessionResponse,
    SessionListResponse,
)
from orchestration.errors import SessionNotFound
from services import database as db

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=SessionListResponse)
async def list_sessions(limit: int = 100):
    """List all sessions."""
    sessions = db.list_sessions(limit=limit)

    return SessionListResponse(
        sessions=[SessionResponse(**s) for s in sessions],
        total=len(sessions),
    )


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: int):
    """Get session by ID."""
    session = db.get_session_by_id(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return SessionResponse(**session)


@router.delete("/{session_id}")
async def delete_session(session_id: int):
    """Delete a session."""
    success = db.delete_session(session_id)

    if not success:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"success": True, "message": "Session deleted"}


@router.patch("/{session_id}")
async def update_session(session_id: int, request: SessionUpdate):
    """Update session."""
    session = db.get_session_by_id(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if request.phase:
        session = db.update_session_phase(session_id, request.phase)

    if request.status:
        session = db.update_session_status(session_id, request.status)

    return SessionResponse(**session)
