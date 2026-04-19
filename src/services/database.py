"""Database service for Neon PostgreSQL."""

import os
from contextlib import contextmanager
from typing import Any, Generator, Optional

import psycopg
from psycopg import Connection
from config import get_settings


class Database:
    """Database connection manager for Neon."""

    def __init__(self, connection_string: Optional[str] = None):
        self._connection_string = connection_string or get_settings().neon_connection_string

    @contextmanager
    def connection(self) -> Generator[Connection, None, None]:
        """Get a database connection context manager."""
        conn = psycopg.connect(self._connection_string)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    @contextmanager
    def cursor(self) -> Generator[psycopg.Cursor, None, None]:
        """Get a cursor context manager."""
        with self.connection() as conn:
            yield conn.cursor()

    def execute(self, query: str, params: tuple = None) -> list[dict[str, Any]]:
        """Execute a query and return results as list of dicts."""
        with self.cursor() as cur:
            cur.execute(query, params)
            if cur.description:
                columns = [desc[0] for desc in cur.description]
                return [dict(zip(columns, row)) for row in cur.fetchall()]
            return []

    def execute_one(self, query: str, params: tuple = None) -> Optional[dict[str, Any]]:
        """Execute a query and return first result as dict."""
        results = self.execute(query, params)
        return results[0] if results else None

    def execute_many(self, queries: list[tuple[str, tuple]]) -> None:
        """Execute multiple queries in a single transaction."""
        with self.connection() as conn:
            with conn.cursor() as cur:
                for query, params in queries:
                    cur.execute(query, params)
            conn.commit()


# Singleton instance
_db: Optional[Database] = None


def get_db() -> Database:
    """Get database singleton instance."""
    global _db
    if _db is None:
        _db = Database()
    return _db


# Session operations
def create_session(
    project_dir: str,
    project_name: str,
    planner_model: str = None,
    builder_model: str = None,
    tester_model: str = None,
) -> dict[str, Any]:
    """Create a new session."""
    db = get_db()
    return db.execute_one(
        """
        INSERT INTO sessions (project_dir, project_name, planner_model, builder_model, tester_model)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING *
        """,
        (project_dir, project_name, planner_model, builder_model, tester_model),
    )


def get_session(project_dir: str) -> Optional[dict[str, Any]]:
    """Get session by project directory."""
    db = get_db()
    return db.execute_one(
        "SELECT * FROM sessions WHERE project_dir = %s",
        (project_dir,),
    )


def get_session_by_id(session_id: int) -> Optional[dict[str, Any]]:
    """Get session by ID."""
    db = get_db()
    return db.execute_one(
        "SELECT * FROM sessions WHERE id = %s",
        (session_id,),
    )


def list_sessions(limit: int = 100) -> list[dict[str, Any]]:
    """List all sessions."""
    db = get_db()
    return db.execute(
        "SELECT * FROM sessions ORDER BY updated_at DESC LIMIT %s",
        (limit,),
    )


def update_session_phase(session_id: int, phase: str) -> dict[str, Any]:
    """Update session phase."""
    db = get_db()
    return db.execute_one(
        """
        UPDATE sessions SET phase = %s, updated_at = NOW()
        WHERE id = %s
        RETURNING *
        """,
        (phase, session_id),
    )


def update_session_status(session_id: int, status: str) -> dict[str, Any]:
    """Update session status."""
    db = get_db()
    completed_at = "NOW()" if status in ("completed", "aborted", "failed") else "NULL"
    query = f"""
        UPDATE sessions SET status = %s, updated_at = NOW(), completed_at = {completed_at}
        WHERE id = %s
        RETURNING *
    """
    return db.execute_one(query, (status, session_id))


def delete_session(session_id: int) -> bool:
    """Delete a session."""
    db = get_db()
    result = db.execute_one(
        "DELETE FROM sessions WHERE id = %s RETURNING id",
        (session_id,),
    )
    return result is not None


# Ticket operations
def create_ticket(
    session_id: int,
    ticket_id: int,
    title: str,
    file_path: str = None,
    dependencies: list = None,
    steps: list = None,
    max_retries: int = 3,
) -> dict[str, Any]:
    """Create a new ticket."""
    db = get_db()
    return db.execute_one(
        """
        INSERT INTO tickets (session_id, ticket_id, title, file_path, dependencies, steps, max_retries)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (session_id, ticket_id, title, file_path, dependencies, steps, max_retries),
    )


def get_ticket(ticket_id: int) -> Optional[dict[str, Any]]:
    """Get ticket by ID."""
    db = get_db()
    return db.execute_one(
        "SELECT * FROM tickets WHERE id = %s",
        (ticket_id,),
    )


def list_tickets(session_id: int) -> list[dict[str, Any]]:
    """List all tickets for a session."""
    db = get_db()
    return db.execute(
        "SELECT * FROM tickets WHERE session_id = %s ORDER BY ticket_id",
        (session_id,),
    )


def update_ticket_status(
    ticket_id: int,
    status: str,
    error: str = None,
    from_status: str = None,
) -> dict[str, Any]:
    """Update ticket status."""
    db = get_db()
    result = db.execute_one(
        """
        UPDATE tickets SET status = %s, error = %s, updated_at = NOW()
        WHERE id = %s
        RETURNING *
        """,
        (ticket_id, error, ticket_id),
    )
    if from_status and result:
        db.execute(
            """
            INSERT INTO ticket_logs (ticket_id, from_status, to_status)
            VALUES (%s, %s, %s)
            """,
            (ticket_id, from_status, status),
        )
    return result


def increment_ticket_retries(ticket_id: int) -> int:
    """Increment ticket retries and return new count."""
    db = get_db()
    result = db.execute_one(
        """
        UPDATE tickets SET retries = retries + 1, updated_at = NOW()
        WHERE id = %s
        RETURNING retries
        """,
        (ticket_id,),
    )
    return result["retries"] if result else 0


# Agent output operations
def save_agent_output(
    session_id: int,
    agent: str,
    output: str,
) -> dict[str, Any]:
    """Save agent output."""
    db = get_db()
    return db.execute_one(
        """
        INSERT INTO agent_outputs (session_id, agent, output)
        VALUES (%s, %s, %s)
        RETURNING *
        """,
        (session_id, agent, output),
    )


def get_agent_outputs(session_id: int, agent: str = None) -> list[dict[str, Any]]:
    """Get agent outputs."""
    db = get_db()
    if agent:
        return db.execute(
            "SELECT * FROM agent_outputs WHERE session_id = %s AND agent = %s ORDER BY timestamp",
            (session_id, agent),
        )
    return db.execute(
        "SELECT * FROM agent_outputs WHERE session_id = %s ORDER BY timestamp",
        (session_id,),
    )


# Intervention operations
def create_intervention(
    session_id: int,
    ticket_id: int,
    error: str,
) -> dict[str, Any]:
    """Create a new intervention."""
    db = get_db()
    return db.execute_one(
        """
        INSERT INTO interventions (session_id, ticket_id, error)
        VALUES (%s, %s, %s)
        RETURNING *
        """,
        (session_id, ticket_id, error),
    )


def respond_intervention(
    intervention_id: int,
    response: str,
) -> dict[str, Any]:
    """Respond to an intervention."""
    db = get_db()
    return db.execute_one(
        """
        UPDATE interventions SET response = %s, timestamp = NOW()
        WHERE id = %s
        RETURNING *
        """,
        (response, intervention_id),
    )


def get_pending_intervention(session_id: int) -> Optional[dict[str, Any]]:
    """Get pending intervention for session."""
    db = get_db()
    return db.execute_one(
        """
        SELECT * FROM interventions
        WHERE session_id = %s AND response IS NULL
        ORDER BY timestamp DESC
        LIMIT 1
        """,
        (session_id,),
    )
