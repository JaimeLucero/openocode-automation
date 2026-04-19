"""State machine for orchestration."""

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from orchestration.errors import InvalidPhaseTransition
from orchestration.phase import Phase, TicketStatus, VALID_PHASE_TRANSITIONS, can_transition


@dataclass
class Ticket:
    """Represents a ticket."""

    id: int
    title: str
    file_path: str = ""
    dependencies: List[int] = field(default_factory=list)
    steps: List[str] = field(default_factory=list)
    status: TicketStatus = TicketStatus.PENDING
    retries: int = 0
    max_retries: int = 3
    error: str = ""
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ticket_id": self.id,
            "title": self.title,
            "file_path": self.file_path,
            "dependencies": self.dependencies,
            "steps": self.steps,
            "status": self.status.value,
            "retries": self.retries,
            "max_retries": self.max_retries,
            "error": self.error,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Ticket":
        return cls(
            id=data["ticket_id"],
            title=data["title"],
            file_path=data.get("file_path", ""),
            dependencies=data.get("dependencies", []),
            steps=data.get("steps", []),
            status=TicketStatus(data.get("status", "pending")),
            retries=data.get("retries", 0),
            max_retries=data.get("max_retries", 3),
            error=data.get("error", ""),
            created_at=data.get("created_at", time.time()),
            updated_at=data.get("updated_at", time.time()),
        )


class StateMachine:
    """Manages ticket queue and phase transitions."""

    def __init__(self):
        self._current_phase: Phase = Phase.PENDING
        self._tickets: List[Ticket] = []
        self._current_ticket_index: int = 0
        self._waiting_for_intervention: bool = False
        self._skills_loaded: Dict[str, bool] = {
            "planner": False,
            "builder": False,
            "tester": False,
        }
        self._opencode_ready: Dict[str, bool] = {
            "planner": False,
            "builder": False,
            "tester": False,
        }
        self._project_context: str = ""
        self._full_plan_output: str = ""

    @property
    def current_phase(self) -> Phase:
        return self._current_phase

    @property
    def current_ticket(self) -> Optional[Ticket]:
        if self._current_ticket_index < len(self._tickets):
            return self._tickets[self._current_ticket_index]
        return None

    @property
    def tickets(self) -> List[Ticket]:
        return self._tickets

    @property
    def is_running(self) -> bool:
        return self._current_phase not in (
            Phase.COMPLETED,
            Phase.FAILED,
            Phase.ABORTED,
            Phase.PENDING,
        )

    def set_phase(self, phase: Phase, force: bool = False) -> bool:
        """Set current phase with validation."""
        if not force and not can_transition(self._current_phase, phase):
            self._current_phase = Phase.USER_INTERVENTION
            self._waiting_for_intervention = True
            return False

        self._current_phase = phase
        self._waiting_for_intervention = phase == Phase.USER_INTERVENTION
        return True

    def set_tickets(self, tickets: List[Ticket]) -> None:
        """Set tickets from parsed plan."""
        self._tickets = tickets
        self._current_ticket_index = 0

    def parse_plan(self, plan_output: str) -> List[Ticket]:
        """Parse planner output to extract tickets."""
        import re

        tickets = []
        current_ticket = None
        current_steps = []

        lines = plan_output.split("\n")
        for line in lines:
            line = line.strip()

            if line.startswith("## Ticket") or line.startswith("## ticket"):
                if current_ticket:
                    current_ticket.steps = current_steps
                    tickets.append(current_ticket)

                match = re.search(r"(?:Ticket\s+)?(\d+)[\s:-]+(.+)", line, re.IGNORECASE)
                if match:
                    ticket_id = int(match.group(1))
                    title = match.group(2).strip()
                    current_ticket = Ticket(id=ticket_id, title=title)
                    current_steps = []

            elif current_ticket and line.startswith("**File**"):
                match = re.search(r"\*\*File\*\*:\s*(.+)", line)
                if match:
                    current_ticket.file_path = match.group(1).strip()

            elif current_ticket and "**Dependencies**" in line:
                match = re.search(r"\*\*Dependencies\*\*:\s*(.+)", line)
                if match:
                    deps = match.group(1).strip()
                    if deps.lower() != "none":
                        current_ticket.dependencies = [int(d) for d in re.findall(r"#?(\d+)", deps)]

            elif current_ticket and "**Steps**" in line:
                continue

            elif current_ticket and line:
                step_match = re.match(r"^\d+[\.\)]\s*(.+)", line)
                if step_match:
                    current_steps.append(step_match.group(1).strip())

        if current_ticket:
            current_ticket.steps = current_steps
            tickets.append(current_ticket)

        self._tickets = tickets
        self._full_plan_output = plan_output
        return tickets

    def validate_plan(self) -> tuple[bool, str]:
        """Validate current plan."""
        issues = []

        if not self._tickets:
            issues.append("No tickets found in plan output")

        if not self._project_context:
            issues.append("Missing project context")

        ticket_ids = {t.id for t in self._tickets}
        for ticket in self._tickets:
            if not ticket.title:
                issues.append(f"Ticket #{ticket.id} missing title")
            if not ticket.file_path:
                issues.append(f"Ticket #{ticket.id} missing file path")
            if not ticket.steps:
                issues.append(f"Ticket #{ticket.id} has no implementation steps")
            for dep in ticket.dependencies:
                if dep not in ticket_ids:
                    issues.append(f"Ticket #{ticket.id} depends on non-existent Ticket #{dep}")

        is_valid = len(issues) == 0
        issue_text = "\n".join(f"- {issue}" for issue in issues) if issues else ""

        if is_valid:
            self._current_phase = Phase.PLAN_VALIDATED

        return is_valid, issue_text

    def mark_implementing(self) -> bool:
        """Mark current ticket as implementing."""
        if self._current_phase not in (Phase.PLAN_VALIDATED, Phase.TEST_FAILED):
            self._current_phase = Phase.USER_INTERVENTION
            self._waiting_for_intervention = True
            return False

        ticket = self.current_ticket
        if ticket:
            ticket.status = TicketStatus.IN_PROGRESS
        self._current_phase = Phase.IMPLEMENTING
        return True

    def mark_testing(self) -> bool:
        """Mark current ticket as testing."""
        if self._current_phase != Phase.IMPLEMENTING:
            self._current_phase = Phase.USER_INTERVENTION
            self._waiting_for_intervention = True
            return False

        self._current_phase = Phase.TESTING
        return True

    def handle_test_failure(self, error: str) -> bool:
        """Handle test failure."""
        ticket = self.current_ticket
        if not ticket:
            return False

        ticket.error = error
        ticket.retries += 1
        ticket.updated_at = time.time()

        if ticket.retries >= ticket.max_retries:
            self._current_phase = Phase.USER_INTERVENTION
            self._waiting_for_intervention = True
            return False

        self._current_phase = Phase.TEST_FAILED
        return True

    def mark_test_passed(self) -> bool:
        """Mark current ticket as passed."""
        ticket = self.current_ticket
        if ticket:
            ticket.status = TicketStatus.COMPLETED
        self._current_phase = Phase.NEXT_TICKET
        return True

    def should_retry(self) -> bool:
        """Check if should retry current ticket."""
        ticket = self.current_ticket
        if not ticket:
            return False
        return ticket.retries < ticket.max_retries

    def increment_ticket(self) -> bool:
        """Move to next ticket."""
        self._current_ticket_index += 1
        if self._current_ticket_index >= len(self._tickets):
            self._current_phase = Phase.COMPLETED
            return False
        return True

    def skip_current_ticket(self) -> None:
        """Skip current ticket."""
        ticket = self.current_ticket
        if ticket:
            ticket.status = TicketStatus.SKIPPED
        self.increment_ticket()

    def is_complete(self) -> bool:
        """Check if automation is complete."""
        return self._current_phase in (
            Phase.COMPLETED,
            Phase.FAILED,
            Phase.ABORTED,
        )

    def request_intervention(self, reason: str) -> None:
        """Request user intervention."""
        self._current_phase = Phase.USER_INTERVENTION
        self._waiting_for_intervention = True

    def handle_user_response(self, response: str) -> None:
        """Handle user intervention response."""
        self._waiting_for_intervention = False
        ticket = self.current_ticket

        if response.lower() in ("skip", "s"):
            if ticket:
                ticket.status = TicketStatus.SKIPPED
            self._current_phase = Phase.NEXT_TICKET

        elif response.lower() in ("fix", "f", "resume"):
            if ticket:
                ticket.retries = 0
            self._current_phase = Phase.IMPLEMENTING

        elif response.lower() in ("abort", "a"):
            self._current_phase = Phase.ABORTED

    def get_progress(self) -> Dict[str, Any]:
        """Get progress statistics."""
        total = len(self._tickets)
        completed = sum(1 for t in self._tickets if t.status == TicketStatus.COMPLETED)
        failed = sum(
            1 for t in self._tickets if t.status in (TicketStatus.FAILED, TicketStatus.SKIPPED)
        )
        pending = total - completed - failed

        return {
            "total": total,
            "completed": completed,
            "failed": failed,
            "pending": pending,
            "current_ticket": self.current_ticket.title if self.current_ticket else None,
            "phase": self._current_phase.value,
            "skills_loaded": self._skills_loaded,
            "waiting_intervention": self._waiting_for_intervention,
        }

    def to_dict(self) -> Dict[str, Any]:
        """Serialize state."""
        return {
            "phase": self._current_phase.value,
            "current_ticket_index": self._current_ticket_index,
            "tickets": [t.to_dict() for t in self._tickets],
            "skills_loaded": self._skills_loaded,
            "waiting_for_intervention": self._waiting_for_intervention,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "StateMachine":
        """Deserialize state."""
        machine = cls()
        machine._current_phase = Phase(data.get("phase", "pending"))
        machine._current_ticket_index = data.get("current_ticket_index", 0)
        machine._tickets = [Ticket.from_dict(t) for t in data.get("tickets", [])]
        machine._skills_loaded = data.get(
            "skills_loaded", {"planner": True, "builder": True, "tester": True}
        )
        machine._waiting_for_intervention = data.get("waiting_for_intervention", False)
        return machine
