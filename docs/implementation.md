# Implementation Guide

## Prerequisites

- Node.js 18+
- Python 3.10+
- npm or yarn
- opencode CLI installed and accessible in PATH

## Installation

```bash
# Install Electron dependencies
cd electron
npm install

# Install Python dependencies (for development)
cd ..
pip install -e .
```

## Running the Application

```bash
# Start in development mode
cd electron
npm run dev
```

## Project Structure

```
electron/
├── main/                    # Electron main process
│   ├── index.ts            # Entry point + IPC handlers
│   ├── python-bridge.ts   # Python subprocess bridge
│   └── pty-manager.ts     # PTY terminal management
├── renderer/               # React UI
│   ├── App.tsx            # Main component
│   ├── components/         # UI components
│   └── styles/            # CSS styles
└── preload/
    └── index.ts           # Context bridge
```

## Development

### Running in Development

```bash
cd electron
npm run dev        # Starts both renderer and main process
```

### Building

```bash
npm run build          # Build both renderer and main
npm run package        # Package for current platform
npm run package:win    # Package for Windows
npm run package:mac    # Package for macOS
```

## Onboarding Flow

### Step 1: Project Selection
```typescript
// User clicks "Browse" button
const dir = await window.electron.selectDirectory();
// Returns: "/path/to/project"
```

### Step 2: Telegram Configuration (Optional)
```typescript
// User enters credentials
await window.electron.configureTelegram({
  botToken: "123456:ABC-DEF...",
  chatId: "123456789"
});
```

### Step 3: Model Selection
```typescript
// Select models for agents
await window.electron.startAutomation({
  projectDir: "/path/to/project",
  buildModel: "kimi-k2.5",
  planModel: "kimi-k2.5",
  telegramToken: "...",
  chatId: "..."
});
```

## IPC Communication

### Renderer → Main

```typescript
// Start automation
window.electron.startAutomation(config);

// Send user input
window.electron.sendUserInput("proceed");

// Control
window.electron.pause();
window.electron.resume();
window.electron.stop();
window.electron.skip();
```

### Listening for Events

```typescript
// Terminal output from agents
window.electron.onTerminalOutput((data) => {
  console.log(data.pane, data.output);
});

// Progress updates
window.electron.onProgress((data) => {
  console.log(data.total, data.completed, data.failed, data.pending);
});

// Agent status
window.electron.onAgentStatus((data) => {
  console.log(data.pane, data.status);
});

// User intervention needed
window.electron.onInterventionNeeded((data) => {
  alert(data.reason);
});

// Automation complete
window.electron.onAutomationComplete(() => {
  console.log("All tasks done!");
});
```

## Python Services

### StateMachine Service

```python
from opencode_orchestrator.automation import StateMachineService

state = StateMachineService()
state.load_todos("/path/to/TODO.md")

# Get current state
current = state.get_current_state()
# {
#   "ticket_id": 1,
#   "title": "Implement auth",
#   "phase": "planning",
#   "status": "in_progress",
#   "retries": 0
# }

# Get progress
progress = state.get_progress()
# {
#   "total": 5,
#   "completed": 2,
#   "failed": 0,
#   "pending": 3,
#   "current_ticket": "Implement auth"
# }
```

### MessageRouter Service

```python
from opencode_orchestrator.automation import MessageRouterService

router = MessageRouterService(callback)

# Send to specific agent
router.send_to_planner("plan the next task")
router.send_to_builder("implement the feature")
router.send_to_tester("run the tests")

# Route user input
router.route_user_input("User's message")

# Parse manager decision
command = router.parse_manager_decision("COMMAND: implement")
# Returns: "implement"
```

### AgentManager Service

```python
from opencode_orchestrator.automation import AgentManagerService

manager = AgentManagerService(callback)
manager.initialize(
    project_dir="/path/to/project",
    build_model="kimi-k2.5",
    plan_model="kimi-k2.5"
)

# Spawn all agents
manager.spawn_all()

# Send command to agent
manager.send_to_agent("builder", "proceed")

# Check status
status = manager.check_all_status()
# {
#   "planner": "running",
#   "builder": "waiting",
#   "tester": "idle",
#   "manager_waiting": True
# }

# Cleanup
manager.cleanup()
```

### Notification Service

```python
from opencode_orchestrator.automation import NotificationService

notifier = NotificationService(callback)
notifier.configure(bot_token="...", chat_id="...")

# Send notification
notifier.notify("completed", "Task 1 completed")
notifier.notify("failed", "Task 2 failed after 3 retries")
```

## Skills Configuration

Agents use smithery.ai skills for specialization:

```python
SKILLS = {
    "planner": "npx @smithery/cli@latest skill add ruvnet/agent-code-goal-planner --agent opencode",
    "builder": "npx @smithery/cli@latest skill add davila7/senior-backend --agent opencode",
    "tester": "npx @smithery/cli@latest skill add personamanagmentlayer/qa-expert --agent opencode",
}
```

To add custom skills, update `agent_manager.py`:

```python
SKILLS = {
    "planner": "npx @smithery/cli@latest skill add YOUR/SKILL --agent opencode",
    # ...
}
```

## State Machine

```
PENDING → PLANNING → IMPLEMENTING → TESTING → COMPLETED/FAILED
```

Add custom phases in `state_machine.py`:

```python
class Phase(Enum):
    PENDING = "pending"
    PLANNING = "planning"
    IMPLEMENTING = "implementing"
    TESTING = "testing"
    REVIEWING = "reviewing"  # New phase
    COMPLETED = "completed"
    FAILED = "failed"
```

## Telegram Integration

### Bot Setup

1. Create bot via @BotFather
2. Get bot token
3. Get chat ID via @userinfobot

### Events Notified

| Event | Emoji | Description |
|-------|-------|-------------|
| started | 🚀 | Automation started |
| paused | ⏸ | Automation paused |
| resumed | ▶ | Automation resumed |
| stopped | ⏹ | Automation stopped |
| completed | ✅ | Task completed |
| failed | ❌ | Task failed |
| retry | 🔄 | Retrying task |
| intervention | 🆘 | User needed |

## Debugging

### Enable Logging

```typescript
// In main/index.ts
import log from 'electron-log';
log.initialize();
log.transports.file.level = 'debug';
```

### View Python Output

```python
# In electron_service.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Inspect IPC

```typescript
// Add logging in renderer
window.electron.onTerminalOutput((data) => {
  console.log(`[${data.pane}]`, data.output);
});
```

## Troubleshooting

### Electron won't start

```bash
# Clear cache
rm -rf node_modules/.cache

# Rebuild native modules
npm rebuild
```

### Python subprocess fails

```bash
# Check Python path
which python3

# Test import
python3 -c "from opencode_orchestrator.automation import StateMachineService"
```

### PTY not working

```bash
# Install dependencies
npm install node-pty

# Rebuild
npm rebuild node-pty
```

### Skills not loading

```bash
# Verify npx works
npx @smithery/cli@latest --version

# Check smithery.ai access
curl https://smithery.ai
```

## Packaging

### PyInstaller (Python)

```bash
cd pyinstaller
pyinstaller spec.py
```

### Electron Builder

```bash
cd electron
npm run package
```

Output will be in `electron/release/`.
