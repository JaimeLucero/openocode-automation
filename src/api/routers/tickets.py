"""Ticket API routes."""

from fastapi import APIRouter, HTTPException

from api.schemas.ticket import (
    TicketCreate,
    TicketUpdate,
    TicketResponse,
    TicketListResponse,
)
from orchestration.errors import TicketNotFound
from orchestration.machine import Ticket as TicketModel
from services import database as db

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.get("/session/{session_id}", response_model=TicketListResponse)
async def list_tickets(session_id: int):
    """List all tickets for a session."""
    session = db.get_session_by_id(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    tickets = db.list_tickets(session_id)

    return TicketListResponse(
        tickets=[TicketResponse(**t) for t in tickets],
        total=len(tickets),
    )


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(ticket_id: int):
    """Get ticket by ID."""
    ticket = db.get_ticket(ticket_id)

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return TicketResponse(**ticket)


@router.patch("/{ticket_id}")
async def update_ticket(ticket_id: int, request: TicketUpdate):
    """Update ticket."""
    ticket = db.get_ticket(ticket_id)

    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if request.status:
        ticket = db.update_ticket_status(
            ticket_id,
            request.status,
            error=request.error,
            from_status=ticket["status"],
        )

    return TicketResponse(**ticket)
