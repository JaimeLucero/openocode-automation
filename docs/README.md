# OpenCode Orchestrator

Desktop automation app for software development using specialized OpenCode agents with FastAPI backend and Neon database.

## Overview

OpenCode Orchestrator automates software development tasks using three specialized AI agents:

- **Planner Agent** - Goal planning and task decomposition
- **Builder Agent** - Backend code implementation
- **Tester Agent** - QA and testing

## Features

- **FastAPI Backend** - REST API with WebSocket for real-time updates
- **Neon Database** - PostgreSQL for state persistence
- **Desktop App** - Electron-based with native UI
- **Multi-Agent System** - Specialized agents for each phase
- **Phase Validation** - Automated guardrails for state transitions
- **Telegram Integration** - Remote notifications and commands

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Desktop App                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  React UI (Onboarding, Terminals, Controls)         │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                               │
│                   HTTP/WebSocket                    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────┐
│                    FastAPI Backend                  │
│  ┌─────────────────────────────────────────────────┐ │
│  │  API Routes + WebSocket                        │ │
│  └─────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Orchestration (StateMachine, Engine)            │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────┐
│                    Neon Database                    │
│            (PostgreSQL - hosted)                  │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- Neon PostgreSQL database

### 1. Set up Neon Database

Copy `src/services/schema.sql` and run it in your Neon SQL editor.

### 2. Configure Environment

```bash
# Copy and edit config
cp src/.env.example src/.env

# Edit src/.env with your Neon connection string
NEON_CONNECTION_STRING=postgresql://user:pass@host.neon.tech/dbname?sslmode=require
```

### 3. Install Dependencies

```bash
cd src
pip install -r requirements.txt
```

### 4. Run FastAPI Server

```bash
python -m uvicorn main:app --reload
```

### 5. Run Electron App

```bash
cd electron
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/automation/start` | Start automation |
| POST | `/api/v1/automation/stop` | Stop automation |
| POST | `/api/v1/automation/pause` | Pause automation |
| POST | `/api/v1/automation/resume` | Resume automation |
| GET | `/api/v1/automation/status` | Get status |
| POST | `/api/v1/automation/input` | Send user input |
| GET | `/api/v1/sessions` | List sessions |
| GET | `/api/v1/sessions/{id}` | Get session |
| GET | `/api/v1/tickets/session/{id}` | List tickets |
| WS | `/api/v1/automation/ws` | Real-time updates |

## Phase Flow

```
PENDING → INITIALIZING → LOADING_SKILLS → SKILLS_READY → PLANNING → PLAN_VALIDATED 
      → IMPLEMENTING → TESTING → NEXT_TICKET → COMPLETED
```

Invalid transitions automatically pause and request user intervention.

## Commands

### Makefile

```bash
make install          # Install package
make install-dev     # Install with dev dependencies
make test           # Run tests
make format        # Format code
make lint          # Lint code
make type-check   # Type check
make clean        # Clean build artifacts
```

## Documentation

- [Architecture](architecture.md) - System design and components
- [TODO Format](todo-format.md) - TODO.md file reference