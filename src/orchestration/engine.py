"""Main orchestration engine."""

import asyncio
import threading
from typing import Any, Callable, Dict, List, Optional
from pathlib import Path

from orchestration.errors import (
    AutomationNotRunning,
    InvalidPhaseTransition,
    SessionNotFound,
)
from orchestration.phase import Phase
from orchestration.machine import StateMachine, Ticket
from services import database as db


class OrchestrationEngine:
    """Main orchestration engine coordinating automation."""

    def __init__(self, output_callback: Optional[Callable] = None):
        self.output_callback = output_callback
        self._machine = StateMachine()
        self._session_id: Optional[int] = None
        self._running = False
        self._paused = False
        self._thread: Optional[threading.Thread] = None
        self._project_dir: str = ""
        self._project_context: str = ""

    @property
    def session_id(self) -> Optional[int]:
        return self._session_id

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def machine(self) -> StateMachine:
        return self._machine

    def _output(self, pane: str, message: str) -> None:
        """Send output via callback."""
        if self.output_callback:
            self.output_callback(pane, message)

    def start(
        self,
        project_dir: str,
        project_context: str,
        planner_model: str = "kimi-k2.5",
        builder_model: str = "kimi-k2.5",
        tester_model: str = "kimi-k2.5",
    ) -> int:
        """Start new automation session."""
        self._project_dir = project_dir
        self._project_context = project_context
        self._machine = StateMachine()

        session = db.create_session(
            project_dir=str(project_dir),
            project_name=Path(project_dir).name,
            planner_model=planner_model,
            builder_model=builder_model,
            tester_model=tester_model,
        )
        self._session_id = session["id"]
        self._running = True
        self._paused = False

        self._output("system", f"[ORCHESTRATOR] Started session {self._session_id}")
        return self._session_id

    def load_state(self, session_id: int) -> bool:
        """Load state from database for existing session."""
        session = db.get_session_by_id(session_id)
        if not session:
            raise SessionNotFound(session_id=session_id)

        self._session_id = session_id
        self._project_dir = session["project_dir"]
        self._machine._current_phase = Phase(session["phase"])

        tickets = db.list_tickets(session_id)
        if tickets:
            self._machine._tickets = [
                Ticket(
                    id=t["ticket_id"],
                    title=t["title"],
                    file_path=t["file_path"] or "",
                    dependencies=t["dependencies"] or [],
                    steps=t["steps"] or [],
                )
                for t in tickets
            ]

        db.update_session_status(session_id, "active")
        self._running = True
        return True

    def stop(self) -> None:
        """Stop the automation."""
        if self._session_id:
            db.update_session_status(self._session_id, "aborted")
        self._running = False
        self._output("system", "[ORCHESTRATOR] Stopped")

    def pause(self) -> None:
        """Pause automation."""
        self._paused = True
        self._output("system", "[ORCHESTRATOR] Paused")

    def resume(self) -> None:
        """Resume automation."""
        self._paused = False
        self._output("system", "[ORCHESTRATOR] Resumed")

    def set_phase(self, phase: Phase, force: bool = False) -> bool:
        """Set current phase."""
        success = self._machine.set_phase(phase, force)
        if self._session_id:
            db.update_session_phase(self._session_id, self._machine.current_phase.value)
        return success

    def parse_plan(self, plan_output: str) -> List[Ticket]:
        """Parse plan output and create tickets."""
        tickets = self._machine.parse_plan(plan_output)

        if self._session_id:
            for ticket in tickets:
                db.create_ticket(
                    session_id=self._session_id,
                    ticket_id=ticket.id,
                    title=ticket.title,
                    file_path=ticket.file_path,
                    dependencies=ticket.dependencies,
                    steps=ticket.steps,
                    max_retries=ticket.max_retries,
                )

        return tickets

    def validate_plan(self) -> tuple[bool, str]:
        """Validate the current plan."""
        is_valid, issues = self._machine.validate_plan()
        if is_valid and self._session_id:
            db.update_session_phase(self._session_id, self._machine.current_phase.value)
        return is_valid, issues

    def mark_implementing(self) -> bool:
        """Mark current ticket as implementing."""
        success = self._machine.mark_implementing()
        self._save_ticket_status()
        return success

    def mark_testing(self) -> bool:
        """Mark current ticket as testing."""
        success = self._machine.mark_testing()
        return success

    def handle_test_failure(self, error: str) -> bool:
        """Handle test failure."""
        success = self._machine.handle_test_failure(error)
        self._save_ticket_status()
        return success

    def mark_test_passed(self) -> bool:
        """Mark test as passed."""
        success = self._machine.mark_test_passed()
        self._save_ticket_status()
        return success

    def increment_ticket(self) -> bool:
        """Move to next ticket."""
        success = self._machine.increment_ticket()
        return success

    def skip_ticket(self) -> None:
        """Skip current ticket."""
        self._machine.skip_current_ticket()
        self._save_ticket_status()

    def handle_user_response(self, response: str) -> None:
        """Handle user intervention response."""
        self._machine.handle_user_response(response)
        self._save_ticket_status()

        if self._machine.current_phase == Phase.COMPLETED and self._session_id:
            db.update_session_status(self._session_id, "completed")

    def get_status(self) -> Dict[str, Any]:
        """Get current automation status."""
        return {
            "running": self._running,
            "paused": self._paused,
            "phase": self._machine.current_phase.value,
            "progress": self._machine.get_progress(),
        }

    def get_progress(self) -> Dict[str, Any]:
        """Get progress statistics."""
        return self._machine.get_progress()

    def _save_ticket_status(self) -> None:
        """Save current ticket status to database."""
        ticket = self._machine.current_ticket
        if not ticket or not self._session_id:
            return

        previous_status = "pending"
        for t in db.list_tickets(self._session_id):
            if t["ticket_id"] == ticket.id:
                previous_status = t["status"]
                break

        db.update_ticket_status(
            ticket_id=ticket.id,
            status=ticket.status.value,
            error=ticket.error,
            from_status=previous_status,
        )

    def save_state(self) -> None:
        """Save full state to database."""
        if not self._session_id:
            return

        db.update_session_phase(self._session_id, self._machine.current_phase.value)

        for ticket in self._machine.tickets:
            existing = db.get_ticket(ticket.id)
            if not existing:
                db.create_ticket(
                    session_id=self._session_id,
                    ticket_id=ticket.id,
                    title=ticket.title,
                    file_path=ticket.file_path,
                    dependencies=ticket.dependencies,
                    steps=ticket.steps,
                    max_retries=ticket.max_retries,
                )
            else:
                db.update_ticket_status(
                    ticket_id=ticket.id,
                    status=ticket.status.value,
                    error=ticket.error,
                )


# Singleton for active orchestration
_active_engine: Optional[OrchestrationEngine] = None


def get_active_engine() -> Optional[OrchestrationEngine]:
    """Get the active orchestration engine."""
    return _active_engine


def set_active_engine(engine: OrchestrationEngine) -> None:
    """Set the active orchestration engine."""
    global _active_engine
    _active_engine = engine


def get_or_create_engine() -> OrchestrationEngine:
    """Get or create active engine."""
    global _active_engine
    if _active_engine is None:
        _active_engine = OrchestrationEngine()
    return _active_engine
