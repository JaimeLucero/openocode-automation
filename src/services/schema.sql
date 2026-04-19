-- OpenCode Orchestrator Neon Schema Migration
-- Run this SQL in your Neon database to create the required tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions (projects)
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    project_dir TEXT UNIQUE NOT NULL,
    project_name TEXT NOT NULL,
    phase TEXT NOT NULL DEFAULT 'pending',
    planner_model TEXT,
    builder_model TEXT,
    tester_model TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Tickets
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    ticket_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    file_path TEXT,
    dependencies JSONB DEFAULT '[]',
    steps JSONB DEFAULT '[]',
    status TEXT DEFAULT 'pending',
    retries INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- State Transitions Log
CREATE TABLE ticket_logs (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT,
    reason TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Outputs
CREATE TABLE agent_outputs (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    agent TEXT NOT NULL,
    output TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- User Interventions
CREATE TABLE interventions (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    ticket_id INTEGER NOT NULL,
    error TEXT,
    response TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tickets_session ON tickets(session_id);
CREATE INDEX idx_ticket_logs_ticket ON ticket_logs(ticket_id);
CREATE INDEX idx_agent_outputs_session ON agent_outputs(session_id);
CREATE INDEX idx_interventions_session ON interventions(session_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_phase ON sessions(phase);