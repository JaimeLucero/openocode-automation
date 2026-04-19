"""Orchestration-specific exceptions."""


class OrchestrationError(Exception):
    """Base exception for orchestration errors."""

    pass


class InvalidPhaseTransition(OrchestrationError):
    """Raised when an invalid phase transition is attempted."""

    def __init__(self, from_phase: str, to_phase: str):
        self.from_phase = from_phase
        self.to_phase = to_phase
        super().__init__(f"Invalid transition from {from_phase} to {to_phase}")


class SessionNotFound(OrchestrationError):
    """Raised when a session is not found."""

    def __init__(self, session_id: int = None, project_dir: str = None):
        self.session_id = session_id
        self.project_dir = project_dir
        identifier = session_id or project_dir
        super().__init__(f"Session not found: {identifier}")


class TicketNotFound(OrchestrationError):
    """Raised when a ticket is not found."""

    def __init__(self, ticket_id: int):
        self.ticket_id = ticket_id
        super().__init__(f"Ticket not found: {ticket_id}")


class AgentError(OrchestrationError):
    """Raised when an agent encounters an error."""

    pass


class AgentNotReady(OrchestrationError):
    """Raised when an agent is not ready."""

    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        super().__init__(f"Agent not ready: {agent_name}")


class AutomationNotRunning(OrchestrationError):
    """Raised when automation is not running."""

    def __init__(self, session_id: int):
        self.session_id = session_id
        super().__init__(f"Automation not running for session: {session_id}")


class MaxRetriesExceeded(OrchestrationError):
    """Raised when max retries are exceeded."""

    def __init__(self, ticket_id: int, retries: int):
        self.ticket_id = ticket_id
        self.retries = retries
        super().__init__(f"Max retries exceeded for ticket {ticket_id} after {retries} attempts")


class ConfigurationError(OrchestrationError):
    """Raised when there's a configuration error."""

    pass
