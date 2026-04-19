# OpenCode Orchestrator - Architecture

Desktop application for automated software development using specialized OpenCode agents with FastAPI backend and Neon database.

## Overview

The OpenCode Orchestrator uses a **multi-agent** pattern where three specialized agents (Planner, Builder, Tester) collaborate to automate software development tasks. The application runs as an Electron desktop app that communicates with a FastAPI backend via HTTP/WebSocket.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Electron Desktop App                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Renderer Process (React + xterm.js)                              │
│  ┌───────────────────────────────────────────────────────┐              │
│  │  Onboarding Flow                                  │              │
│  │  - Project directory selection                   │              │
│  │  - Telegram configuration (optional)          │              │
│  │  - Model selection                           │              │
│  └───────────────────────────────────────────────────────┘              │
│  ┌───────────────────────────────────────────────────────┐              │
│  │  Terminal Split Pane (View-only xterm.js)         │              │
│  │  ┌─────────────┬─────────────┬─────────────┐       │              │
│  │  │ Planner    │ Builder   │ Tester    │       │              │
│  │  │ Agent     │ Agent    │ Agent    │       │              │
│  │  └─────────────┴─────────────┴─────────────┘       │              │
│  └───────────────────────────────────────────────────────┘              │
│  ┌───────────────────────────────────────────────────────┐              │
│  │  User Input Box │ Control Bar                      │              │
│  └───────────────────────────────────────────────────────┘              │
│  ┌───────────────────────────────────────────────────────┐              │
│  │  Progress Dashboard                               │              │
│  └───────────────────────────────────────────────────────┘              │
├──────────���──────────────────────────────────────────────────────────────────┤
│  Main Process                                               │
│  ┌───────────────────────────────────────────────────────┐              │
│  │  ApiClient - HTTP/WebSocket communication with FastAPI │              │
│  │  PtyManager - Terminal session management             │              │
│  └───────────────────────────────────────────────────────┘              │
└────────────────────────────────────────────────────────────────────┘
                           │ HTTP / WebSocket
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  API Layer                                                      │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │ │
│  │  │ Sessions   │  │ Tickets     │  │ Automation          │    │ │
│  │  │ Routes     │  │ Routes     │  │ Routes + WebSocket  │    │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘    │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Orchestration Layer                                       │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │ │
│  │  │ StateMachine │  │ AgentManager│  │ Notifications        │   │ │
│  │  │ (machine.py) │  │ (future)   │  │ (future)            │   │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  Services Layer                                             │ │
│  │  ┌──────────────────────────────────────────────────────┐        │ │
│  │  ���         Database Service (Neon/psycopg)              │        │ │
│  │  └──────────────────────────────────────────────────────┘        │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┬───────┘
                                                   │
                                           ┌───────┴───────┐
                                           │   Neon DB   │
                                           │ (PostgreSQL)│
                                           └─────────────┘
```

## Components

### 1. Electron Main Process

**File:** `electron/main/index.ts`

**Responsibilities:**
- Window management
- IPC handler registration
- API client management
- PTY session coordination

**Key Modules:**
- `api-client.ts` - Manages HTTP/WebSocket communication with FastAPI
- `pty-manager.ts` - Handles terminal sessions

### 2. Electron Renderer (React UI)

**File:** `electron/renderer/App.tsx`

**Components:**
- `Onboarding.tsx` - Project selection, Telegram config, model selection
- `TerminalPane.tsx` - xterm.js wrapper for agent output
- `UserInput.tsx` - User input routing to agents
- `ControlBar.tsx` - Pause/Resume/Stop/Skip controls
- `Progress.tsx` - Progress dashboard

### 3. FastAPI Backend

#### Main Entry Point
**File:** `src/main.py`

**Responsibilities:**
- API router registration
- CORS middleware
- WebSocket handling
- Lifespan management

#### API Routes

**File:** `src/api/routers/automation.py`
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/automation/start` | POST | Start automation |
| `/api/v1/automation/stop` | POST | Stop automation |
| `/api/v1/automation/pause` | POST | Pause automation |
| `/api/v1/automation/resume` | POST | Resume automation |
| `/api/v1/automation/status` | GET | Get status |
| `/api/v1/automation/input` | POST | Send user input |
| `/api/v1/automation/ws` | WebSocket | Real-time updates |

#### Pydantic Schemas

**File:** `src/api/schemas/`
- `automation.py` - Automation request/response models
- `session.py` - Session models
- `ticket.py` - Ticket models

### 4. Orchestration Layer

#### State Machine
**File:** `src/orchestration/machine.py`

Manages ticket lifecycle and phase transitions.

**Phases:**
```
PENDING → INITIALIZING → LOADING_SKILLS → SKILLS_READY → PLANNING → PLAN_VALIDATED → IMPLEMENTING → TESTING → NEXT_TICKET → COMPLETED
```

**Key Methods:**
- `set_phase(phase)` - Set current phase with validation
- `parse_plan(output)` - Parse planner output to tickets
- `validate_plan()` - Validate current plan
- `mark_implementing()` - Mark ticket as implementing
- `mark_testing()` - Mark ticket as testing
- `handle_test_failure(error)` - Handle test failure with retry logic
- `get_progress()` - Overall statistics

#### Phase definitions
**File:** `src/orchestration/phase.py`

- `Phase` enum - All automation phases
- `TicketStatus` enum - Ticket status values
- `VALID_PHASE_TRANSITIONS` - Map of valid transitions
- `can_transition()`, `get_valid_transitions()` - Helper functions

#### Exceptions
**File:** `src/orchestration/errors.py`

- `OrchestrationError` - Base exception
- `InvalidPhaseTransition` - Invalid phase transition
- `SessionNotFound` - Session not found
- `TicketNotFound` - Ticket not found
- `AgentError` - Agent error
- `MaxRetriesExceeded` - Max retries exceeded

#### Engine
**File:** `src/orchestration/engine.py`

Main orchestration engine coordinating automation.

**Key Methods:**
- `start(project_dir, ...)` - Start new session
- `load_state(session_id)` - Load existing session
- `stop()`, `pause()`, `resume()` - Control automation
- `parse_plan()`, `validate_plan()` - Plan handling
- `mark_implementing()`, `mark_testing()`, `handle_test_failure()` - Ticket handling
- `get_status()`, `get_progress()` - Status queries
- `save_state()` - Persist state to Neon

### 5. Services Layer

#### Database Service
**File:** `src/services/database.py`

**Responsibilities:**
- Neon PostgreSQL connection via psycopg
- Session CRUD operations
- Ticket CRUD operations
- Agent output logging
- Intervention tracking

**Key Functions:**
- `create_session()`, `get_session()`, `list_sessions()`, `update_session_phase()`, `update_session_status()`
- `create_ticket()`, `get_ticket()`, `list_tickets()`, `update_ticket_status()`
- `save_agent_output()`, `get_agent_outputs()`
- `create_intervention()`, `respond_intervention()`, `get_pending_intervention()`

### 6. Database Schema (Neon)

**File:** `src/services/schema.sql`

**Tables:**
- `sessions` - Automation sessions (projects)
- `tickets` - Individual tickets
- `ticket_logs` - State transition logs
- `agent_outputs` - Agent output history
- `interventions` - User intervention history

## IPC Protocol

### Electron → FastAPI
| Channel | Payload |
|---------|---------|
| `POST /api/v1/automation/start` | `{project_dir, project_context, planner_model, ...}` |
| `POST /api/v1/automation/input` | `{message}` |
| `POST /api/v1/automation/pause` | `{}` |
| `WebSocket /api/v1/automation/ws` | Real-time events |

### FastAPI → Electron (WebSocket)
| Event | Payload |
|-------|---------|
| `phase-changed` | `{phase}` |
| `progress` | `{total, completed, failed, pending}` |
| `ticket-status` | `{ticket_id, status, phase, retries}` |
| `intervention-needed` | `{reason}` |
| `automation-stopped` | `{}` |

## State Machine

```
                    ┌─────────────┐
                    │   PENDING   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌────────────────────────┐
                    │   INITIALIZING     │
                    │ (Load context)    │
                    └────────┬────────┘
                           │
                           ▼
                    ┌────────────────────────┐
                    │  LOADING_SKILLS   │
                    │ (Agent setup)    │
                    └────────┬────────┘
                           │
           ┌─────────────────┴─────────────────┐
           ▼                                 ▼
    ┌──────────────┐               ┌──────────────┐
    │SKILLS_READY │               │  PLANNING   │
    └─────┬──────┘               └──────┬───────┘
          │                            │
          └───────────┬───────────────┘
                      ▼
              ┌──────────────────┐
              │ PLAN_VALIDATED  │
              └───────┬────────┘
                      │
                      ▼
              ┌──────────────────┐
              │  IMPLEMENTING   │
              │(Build Agent)   │
              └───────┬────────┘
                      │
                      ▼
              ┌──────────────────┐
              │   TESTING      │
              │(Test Agent)   │
              └───────┬────────┘
                      │
         ┌────────────┼────────────┐
         ▼                         ▼
   ┌──────────┐           ┌──────────┐
   │ PASSED  │           │ FAILED  │
   └────┬───┘           └────┬────┘
        │                    │
        │         ┌──────────┼���─���───────┐
        │         ▼                   ▼
        │   [retry]           [max retries]
        │                      │
        │                      ▼
        │              ┌──────────────┐
        │              │USER_INTER- │
        │              │VENTION   │
        │              └────┬─────┘
        │                   │
        ▼                   ▼
  ┌─────────────┐   ┌─────────────┐
  │NEXT_TICKET │   │ ABORTED  │
  └─────┬─────┘   └──────────┘
        │
        └──────► (repeat IMPLEMENTING)
                  or
              ┌─────────────┐
              │ COMPLETED │
              └─────────┘
```

## File Structure

```
opencode-orchestrator/
├── electron/                      # Electron desktop app
│   ├── package.json              # Dependencies
│   ├── main/
│   │   ├── index.ts            # Main process entry
│   │   ├── api-client.ts      # HTTP/WebSocket client
│   │   └── pty-manager.ts   # PTY session management
│   └── renderer/              # React UI
├── src/                          # FastAPI backend
│   ├── main.py                 # FastAPI entry point
│   ├── config.py             # Settings
│   ├── api/                   # API layer
│   │   ├── deps.py           # Dependencies
│   │   ├── routers/        # Route handlers
│   │   │   ├── automation.py
│   │   │   ├── sessions.py
│   │   │   └── tickets.py
│   │   └── schemas/       # Pydantic models
│   │       ├── automation.py
│   │       ├── session.py
│   │       └── ticket.py
│   ├── orchestration/         # Business logic
│   │   ├── engine.py      # Main orchestration
│   │   ├── machine.py   # State machine
│   │   ├── phase.py    # Phase definitions
│   │   └── errors.py  # Exceptions
│   ├── services/             # External integrations
│   │   ├── database.py  # Neon connection
│   │   └── schema.sql  # Database schema
│   └── agents/             # Agent implementations (future)
├── docs/                     # Documentation
├── pyproject.toml            # Python package config
└── Makefile                # Build commands
```

## Configuration

### Environment Variables (.env)

```bash
# Neon Database
NEON_CONNECTION_STRING=postgresql://user:pass@host.neon.tech/dbname?sslmode=require

# FastAPI Server
HOST=0.0.0.0
PORT=8000

# OpenCode API Key (optional)
OPENCODE_API_KEY=your_api_key_here

# Agent Models
PLANNER_MODEL=kimi-k2.5
BUILDER_MODEL=kimi-k2.5
TESTER_MODEL=kimi-k2.5

# Telegram (optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## Error Handling

1. **Invalid phase transition**: Pause automation, request user intervention
2. **Test failure**: Retry with exponential backoff, then request intervention
3. **Neon connection error**: Queue operations, retry with backoff
4. **WebSocket disconnect**: Auto-reconnect with backoff
5. **Max retries exceeded**: Request user intervention via Telegram/UI