"""Automation API routes."""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json

from api.schemas.automation import (
    AutomationStartRequest,
    AutomationStatusResponse,
    AutomationInputRequest,
    AutomationResponse,
    PhaseTransitionRequest,
)
from orchestration.engine import (
    OrchestrationEngine,
    get_active_engine,
    get_or_create_engine,
    set_active_engine,
)
from orchestration.errors import SessionNotFound
from orchestration.phase import Phase
from services import database as db

router = APIRouter(prefix="/automation", tags=["automation"])

# Active websocket connections
_connections: Set[WebSocket] = set()


async def broadcast(message: dict) -> None:
    """Broadcast message to all connected clients."""
    for conn in _connections:
        try:
            await conn.send_json(message)
        except Exception:
            pass


@router.post("/start", response_model=AutomationResponse)
async def start_automation(request: AutomationStartRequest):
    """Start new automation session."""
    engine = get_or_create_engine()

    planner_model = request.planner_model or "opencode/minimax-m2.5-free"
    print(
        f"[start] planner: {planner_model}, builder: {request.builder_model or planner_model}, tester: {request.tester_model or planner_model}"
    )

    session_id = engine.start(
        project_dir=request.project_dir,
        project_context=request.project_context,
        planner_model=planner_model,
        builder_model=request.builder_model or planner_model,
        tester_model=request.tester_model or planner_model,
    )

    engine.set_phase(Phase.PLANNING)
    db.update_session_status(session_id, "active")
    set_active_engine(engine)

    await broadcast({"type": "phase-changed", "phase": Phase.PLANNING.value})
    await broadcast(
        {
            "type": "progress",
            "total": 0,
            "completed": 0,
            "failed": 0,
            "pending": 0,
            "currentTicket": None,
            "message": "Planning...",
        }
    )

    await broadcast(
        {
            "type": "spawn-agent",
            "agentType": "planner",
            "projectDir": request.project_dir,
            "model": planner_model,
        }
    )

    await broadcast(
        {
            "type": "agent-command",
            "agentType": "planner",
            "command": f"Analyze this project and create tickets.",
        }
    )

    return AutomationResponse(
        success=True,
        message=f"Started session {session_id} in PLANNING phase",
        data={"session_id": session_id},
    )


@router.post("/planner-complete", response_model=AutomationResponse)
async def planner_complete(request: dict):
    """Handle planner completion - parse tickets and trigger builder."""
    print("[planner-complete] Starting...")
    engine = get_active_engine()

    if not engine:
        print("[planner-complete] No active engine")
        return AutomationResponse(success=False, message="No automation running")

    plan_output = request.get("output", "")
    print(f"[planner-complete] Plan output length: {len(plan_output)}")
    print(f"[planner-complete] Plan output preview: {plan_output[:500]}")
    if not plan_output:
        print("[planner-complete] No plan output provided")
        return AutomationResponse(success=False, message="No plan output provided")

    tickets = engine.parse_plan(plan_output)
    print(f"[planner-complete] Parsed {len(tickets)} tickets")
    for t in tickets:
        print(
            f"  - Ticket #{t.id}: {t.title}, file: {t.file_path}, steps: {len(t.steps)}, deps: {t.dependencies}"
        )

    is_valid, issues = engine.validate_plan()
    print(f"[planner-complete] Validation: valid={is_valid}, issues={issues}")

    if not is_valid:
        print(f"[planner-complete] Plan validation FAILED: {issues}")
        engine.set_phase(Phase.USER_INTERVENTION)
        await broadcast({"type": "phase-changed", "phase": Phase.USER_INTERVENTION.value})
        return AutomationResponse(success=False, message=f"Plan validation failed: {issues}")

    print(f"[planner-complete] Plan valid, transitioning to IMPLEMENTING...")
    engine.set_phase(Phase.IMPLEMENTING)
    db.update_session_status(engine.session_id, "active")

    print("[planner-complete] Broadcasting phase-changed...")
    await broadcast({"type": "phase-changed", "phase": Phase.IMPLEMENTING.value})

    print(f"[planner-complete] Broadcasting progress: total={len(tickets)}, pending={len(tickets)}")
    await broadcast(
        {
            "type": "progress",
            "total": len(tickets),
            "completed": 0,
            "failed": 0,
            "pending": len(tickets),
            "currentTicket": tickets[0].id if tickets else None,
        }
    )

    session = db.get_session_by_id(engine.session_id)
    builder_model = session.get("builder_model") if session else engine.builder_model
    print(f"[planner-complete] DB builder_model = '{builder_model}'")
    print(
        f"[planner-complete] Broadcasting spawn-agent for builder with model: {builder_model or engine.planner_model}"
    )
    await broadcast(
        {
            "type": "spawn-agent",
            "agentType": "builder",
            "projectDir": engine._project_dir,
            "model": builder_model or engine.planner_model,
        }
    )

    if tickets:
        command = f"Implement ticket #{tickets[0].id}: {tickets[0].title}. File: {tickets[0].file_path}. Steps: {', '.join(tickets[0].steps)}"
        print(f"[planner-complete] Broadcasting agent-command: {command[:100]}...")
        await broadcast(
            {
                "type": "agent-command",
                "agentType": "builder",
                "command": command,
            }
        )

    print(f"[planner-complete] Done! Returning {len(tickets)} tickets")
    return AutomationResponse(
        success=True,
        message=f"Plan validated with {len(tickets)} tickets. Starting implementation.",
        data={"tickets": len(tickets)},
    )


@router.post("/builder-complete", response_model=AutomationResponse)
async def builder_complete(request: dict):
    """Handle builder completion - mark implementing done and trigger tester."""
    engine = get_active_engine()

    if not engine:
        return AutomationResponse(success=False, message="No automation running")

    success = engine.mark_implementing()
    if not success:
        return AutomationResponse(success=False, message="Cannot transition to testing phase")

    engine.set_phase(Phase.TESTING)
    db.update_session_status(engine.session_id, "active")
    await broadcast({"type": "phase-changed", "phase": Phase.TESTING.value})

    # Get ticket counts for progress
    all_tickets = engine.machine._tickets
    completed = sum(1 for t in all_tickets if t.status in ("completed", "passed"))
    pending = len(all_tickets) - completed

    print(
        f"[builder-complete] Broadcasting progress: total={len(all_tickets)}, completed={completed}, pending={pending}"
    )
    await broadcast(
        {
            "type": "progress",
            "total": len(all_tickets),
            "completed": completed,
            "failed": 0,
            "pending": pending,
            "currentTicket": engine.machine.current_ticket.id
            if engine.machine.current_ticket
            else None,
        }
    )

    session = db.get_session_by_id(engine.session_id)
    tester_model = session.get("tester_model") if session else engine.tester_model
    ticket = engine.machine.current_ticket
    await broadcast(
        {
            "type": "spawn-agent",
            "agentType": "tester",
            "projectDir": engine._project_dir,
            "model": tester_model or engine.planner_model,
        }
    )

    if ticket:
        await broadcast(
            {
                "type": "agent-command",
                "agentType": "tester",
                "command": f"Test ticket #{ticket.id}: {ticket.title}. File: {ticket.file_path}",
            }
        )

    return AutomationResponse(
        success=True,
        message="Implementation complete. Starting tests.",
    )


@router.post("/tester-complete", response_model=AutomationResponse)
async def tester_complete(request: dict):
    """Handle tester completion - move to next ticket or complete."""
    engine = get_active_engine()

    if not engine:
        return AutomationResponse(success=False, message="No automation running")

    test_passed = request.get("passed", False)
    error = request.get("error", "")

    if test_passed:
        engine.mark_test_passed()
    else:
        engine.handle_test_failure(error)

    current_phase = engine.machine.current_phase

    # Broadcast progress update
    all_tickets = engine.machine._tickets
    completed = sum(1 for t in all_tickets if t.status in ("completed", "passed"))
    failed = sum(1 for t in all_tickets if t.status == "failed")
    pending = len(all_tickets) - completed - failed

    print(
        f"[tester-complete] Broadcasting progress: total={len(all_tickets)}, completed={completed}, failed={failed}, pending={pending}"
    )
    await broadcast(
        {
            "type": "progress",
            "total": len(all_tickets),
            "completed": completed,
            "failed": failed,
            "pending": pending,
        }
    )

    if current_phase == Phase.COMPLETED:
        await broadcast({"type": "phase-changed", "phase": Phase.COMPLETED.value})
        if engine.session_id:
            db.update_session_status(engine.session_id, "completed")
        return AutomationResponse(success=True, message="All tickets completed!")

    engine.set_phase(Phase.IMPLEMENTING)
    db.update_session_status(engine.session_id, "active")
    await broadcast({"type": "phase-changed", "phase": Phase.IMPLEMENTING.value})

    ticket = engine.machine.current_ticket
    await broadcast(
        {
            "type": "spawn-agent",
            "agentType": "builder",
            "projectDir": engine._project_dir,
            "model": engine.builder_model,
        }
    )

    if ticket:
        await broadcast(
            {
                "type": "agent-command",
                "agentType": "builder",
                "command": f"Implement ticket #{ticket.id}: {ticket.title}. File: {ticket.file_path}. Steps: {', '.join(ticket.steps)}",
            }
        )

    return AutomationResponse(
        success=True,
        message="Tests passed. Starting next ticket.",
    )


@router.post("/stop", response_model=AutomationResponse)
async def stop_automation():
    """Stop automation."""
    engine = get_active_engine()

    if not engine or not engine.is_running:
        return AutomationResponse(
            success=False,
            message="No automation running",
        )

    engine.stop()
    set_active_engine(None)
    await broadcast({"type": "automation-stopped"})

    return AutomationResponse(
        success=True,
        message="Automation stopped",
    )


@router.post("/force-stop", response_model=AutomationResponse)
async def force_stop_automation():
    """Force stop automation immediately."""
    engine = get_active_engine()

    if not engine:
        return AutomationResponse(
            success=False,
            message="No automation running",
        )

    session_id = engine.session_id
    print(f"[FORCE STOP] session_id={session_id}, running={engine.is_running}")

    try:
        if engine._thread and engine._thread.is_alive():
            engine._thread.terminate()
    except Exception as e:
        print(f"[FORCE STOP] Thread terminate error: {e}")

    engine._running = False
    engine._paused = False

    if session_id:
        try:
            print(f"[FORCE STOP] Updating session {session_id} to aborted")
            db.update_session_status(session_id, "aborted")
            print(f"[FORCE STOP] Session {session_id} updated to aborted")
        except Exception as e:
            print(f"[FORCE STOP] DB update error: {e}")

    set_active_engine(None)
    await broadcast({"type": "automation-stopped"})

    return AutomationResponse(
        success=True,
        message="Automation force stopped",
    )


@router.post("/pause", response_model=AutomationResponse)
async def pause_automation():
    """Pause automation."""
    engine = get_active_engine()

    if not engine or not engine.is_running:
        return AutomationResponse(
            success=False,
            message="No automation running",
        )

    engine.pause()
    await broadcast({"type": "automation-paused"})

    return AutomationResponse(
        success=True,
        message="Automation paused",
    )


@router.post("/resume", response_model=AutomationResponse)
async def resume_automation():
    """Resume automation."""
    engine = get_active_engine()

    if not engine or not engine.is_running:
        return AutomationResponse(
            success=False,
            message="No automation running",
        )

    engine.resume()
    await broadcast({"type": "automation-resumed"})

    return AutomationResponse(
        success=True,
        message="Automation resumed",
    )


@router.get("/status", response_model=AutomationStatusResponse)
async def get_status():
    """Get automation status."""
    engine = get_active_engine()

    if not engine:
        raise HTTPException(status_code=404, detail="No automation running")

    status = engine.get_status()

    return AutomationStatusResponse(
        session_id=engine.session_id or 0,
        running=status["running"],
        paused=status["paused"],
        phase=status["phase"],
        progress=status["progress"],
    )


@router.post("/input", response_model=AutomationResponse)
async def send_input(request: AutomationInputRequest):
    """Send user input to automation."""
    engine = get_active_engine()

    if not engine or not engine.is_running:
        return AutomationResponse(
            success=False,
            message="No automation running",
        )

    message = request.message.lower()

    if message in ("abort", "a"):
        engine.stop()
        return AutomationResponse(success=True, message="Automation aborted")

    if message in ("skip", "s"):
        engine.skip_ticket()
        return AutomationResponse(success=True, message="Ticket skipped")

    if message in ("resume", "r", "fix", "f"):
        engine.handle_user_response(message)
        return AutomationResponse(success=True, message=f"Response: {message}")

    return AutomationResponse(
        success=False,
        message="Unknown command",
    )


@router.post("/phase", response_model=AutomationResponse)
async def set_phase(request: PhaseTransitionRequest):
    """Set phase (for internal use)."""
    engine = get_active_engine()

    if not engine:
        return AutomationResponse(
            success=False,
            message="No automation running",
        )

    try:
        phase = Phase(request.phase)
    except ValueError:
        return AutomationResponse(
            success=False,
            message=f"Invalid phase: {request.phase}",
        )

    success = engine.set_phase(phase, force=request.force)
    await broadcast({"type": "phase-changed", "phase": phase.value})

    return AutomationResponse(
        success=success,
        message=f"Phase set to {phase.value}",
    )


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates."""
    await websocket.accept()
    _connections.add(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    finally:
        _connections.discard(websocket)
