"""Phase definitions and valid transitions for orchestration."""

from enum import Enum
from typing import Dict, List


class Phase(str, Enum):
    """Automation phases."""

    PENDING = "pending"
    INITIALIZING = "initializing"
    LOADING_SKILLS = "loading_skills"
    SKILLS_READY = "skills_ready"
    PLANNING = "planning"
    PLAN_VALIDATED = "plan_validated"
    IMPLEMENTING = "implementing"
    TESTING = "testing"
    TEST_FAILED = "test_failed"
    USER_INTERVENTION = "user_intervention"
    NEXT_TICKET = "next_ticket"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"


class TicketStatus(str, Enum):
    """Ticket status."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


# Valid phase transitions map
VALID_PHASE_TRANSITIONS: Dict[Phase, List[Phase]] = {
    Phase.PENDING: [Phase.INITIALIZING],
    Phase.INITIALIZING: [Phase.LOADING_SKILLS],
    Phase.LOADING_SKILLS: [Phase.SKILLS_READY, Phase.PLANNING],
    Phase.SKILLS_READY: [Phase.PLANNING],
    Phase.PLANNING: [Phase.PLAN_VALIDATED, Phase.USER_INTERVENTION],
    Phase.PLAN_VALIDATED: [Phase.IMPLEMENTING],
    Phase.IMPLEMENTING: [Phase.TESTING, Phase.USER_INTERVENTION],
    Phase.TESTING: [Phase.TEST_FAILED, Phase.NEXT_TICKET],
    Phase.TEST_FAILED: [Phase.IMPLEMENTING, Phase.USER_INTERVENTION],
    Phase.NEXT_TICKET: [Phase.IMPLEMENTING, Phase.COMPLETED],
    Phase.USER_INTERVENTION: [Phase.IMPLEMENTING, Phase.NEXT_TICKET, Phase.ABORTED],
    Phase.COMPLETED: [],
    Phase.FAILED: [],
    Phase.ABORTED: [],
}


# Phase descriptions for UI
PHASE_DESCRIPTIONS: Dict[Phase, str] = {
    Phase.PENDING: "Automation not started",
    Phase.INITIALIZING: "Initializing project context",
    Phase.LOADING_SKILLS: "Loading agent skills",
    Phase.SKILLS_READY: "Skills loaded",
    Phase.PLANNING: "Planning implementation",
    Phase.PLAN_VALIDATED: "Plan validated",
    Phase.IMPLEMENTING: "Implementing changes",
    Phase.TESTING: "Running tests",
    Phase.TEST_FAILED: "Tests failed, retrying",
    Phase.USER_INTERVENTION: "Waiting for user input",
    Phase.NEXT_TICKET: "Moving to next ticket",
    Phase.COMPLETED: "Automation completed",
    Phase.FAILED: "Automation failed",
    Phase.ABORTED: "Automation aborted",
}


def can_transition(from_phase: Phase, to_phase: Phase) -> bool:
    """Check if transition from one phase to another is valid."""
    return to_phase in VALID_PHASE_TRANSITIONS.get(from_phase, [])


def get_valid_transitions(phase: Phase) -> List[Phase]:
    """Get list of valid phases to transition to."""
    return VALID_PHASE_TRANSITIONS.get(phase, [])
