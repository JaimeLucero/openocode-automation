# OpenCode Orchestrator

Automated OpenCode task execution with Telegram integration and LangGraph state management.

## Features

- 🎯 **TODO.md Automation**: Automatically process tasks from markdown files
- 🤖 **OpenCode Integration**: Seamlessly execute OpenCode CLI with configurable models
- 📱 **Telegram Bot**: Real-time notifications and remote control
- 🔄 **Smart Retries**: Automatic retry with 3 attempts before pausing
- 💾 **State Persistence**: Compressed state files with timestamps for resume capability
- 🔒 **Concurrency Control**: Lock file prevents multiple orchestrations
- 🧪 **Test Runner**: Auto-detects npm and pytest projects

## Installation

### Homebrew (Recommended)

```bash
brew tap yourusername/opencode-orchestrator
brew install opencode-orchestrator
```

### From Source

```bash
git clone https://github.com/yourusername/opencode-orchestrator.git
cd opencode-orchestrator
pip install -e .
```

## Prerequisites

- Python 3.10+
- OpenCode CLI installed
- Telegram Bot (from @BotFather)
- Telegram Chat ID (from @userinfobot)

## Quick Start

### 1. Initialize

```bash
opencode-orchestrator init
```

This will:
- Configure Telegram bot credentials
- Show available models
- Create example TODO.md

### 2. Create TODO.md

```markdown
# Project Tasks

## Backend
- [ ] Implement user authentication `test: pytest tests/auth/`
- [ ] Add JWT validation `test: pytest tests/jwt/`

## Frontend
- [ ] Create login form `test: npm test -- Login`
- [ ] Add styling `test: npm run test:unit`
```

### 3. Start Orchestration

```bash
opencode-orchestrator start
```

The orchestrator will:
1. Parse TODO.md
2. Execute each task with OpenCode
3. Run tests automatically
4. Send Telegram notifications on state changes
5. Retry failed tasks up to 3 times
6. Pause and notify after max retries

### 4. Control via Telegram

While running, use Telegram commands:
- `/status` - Check current progress
- `/pause` - Pause after current task
- `/resume` - Resume orchestration
- `/skip` - Skip current task
- `/retry` - Retry failed task
- `/stop` - Stop completely
- `/model <name>` - Change OpenCode model

## Configuration

Configuration is loaded from (in order of priority):
1. Environment variables
2. Project-level `orchestrator.yaml`
3. Global `~/.config/opencode-orchestrator/config.yaml`

### Environment Variables

```bash
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_CHAT_ID="your-chat-id"
export OPENCODE_MODEL="kimi-k2.5"
export ORCHESTRATOR_MAX_RETRIES=3
export ORCHESTRATOR_TIMEOUT=300
```

### Example orchestrator.yaml

```yaml
opencode:
  model: "kimi-k2.5"  # Available: kimi-k2.5, gpt-4, gpt-4-turbo, claude-3-opus, claude-3-sonnet, glm-4, glm-3-turbo

telegram:
  enabled: true
  bot_token: "..."
  chat_id: "..."

orchestrator:
  max_retries: 3
  timeout: 300
```

## Available Models

The following models are supported (hardcoded list):

- `kimi-k2.5` (default)
- `gpt-4`
- `gpt-4-turbo`
- `claude-3-opus`
- `claude-3-sonnet`
- `glm-4`
- `glm-3-turbo`

Change model via:
- CLI: `opencode-orchestrator config --model gpt-4`
- Telegram: `/model gpt-4`

## TODO.md Format

Tasks are parsed from TODO.md with optional inline test commands:

```markdown
- [ ] Task description `test: npm test`
- [ ] Another task `test: pytest tests/`
- [ ] Task with model override `model: claude-3-opus, test: npm test`
```

The orchestrator will:
- Only process incomplete tasks (`- [ ]`)
- Mark tasks as complete (`- [x]`) after success
- Auto-detect test runner if not specified
- Support per-task model overrides

## Commands

```bash
# Initialize configuration
opencode-orchestrator init

# Start orchestration
opencode-orchestrator start
opencode-orchestrator start --model gpt-4

# Resume from saved state
opencode-orchestrator resume

# Check status
opencode-orchestrator status

# Validate TODO.md
opencode-orchestrator validate

# Reset state
opencode-orchestrator reset

# Configuration
opencode-orchestrator config show
opencode-orchestrator config set --model gpt-4
opencode-orchestrator config set --max-retries 5
```

## State Management

State is stored in a compressed binary file (`.opencode_state.bin`):
- Compressed with gzip
- Base64 encoded
- Includes timestamps (created, updated, completed)
- Supports resume after crash

Lock file (`.opencode_orchestrator.lock`) prevents concurrent executions.

## State Machine

```
INIT → PARSE → READY → EXECUTE → VERIFY → (SUCCESS | FAILED)
                           ↑                |
                           └──── RETRY ←────┘
                                          |
                                          v
                                     MAX_RETRIES → WAIT_USER
```

## Architecture

```
CLI → LangGraph State Machine → OpenCode CLI
       ↓                        ↓
    Telegram Bot             Test Runner
       ↓                        ↓
   Notifications          npm / pytest
```

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black src/
ruff check src/

# Type checking
mypy src/
```

## License

MIT License - see LICENSE file

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Support

- GitHub Issues: [github.com/yourusername/opencode-orchestrator/issues](https://github.com/yourusername/opencode-orchestrator/issues)
- Telegram: Use `/help` command in the bot
