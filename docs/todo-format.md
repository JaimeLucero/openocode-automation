# TODO.md Format

The `TODO.md` file defines tasks for the OpenCode Orchestrator to automate. The file is parsed during the onboarding flow when you select your project directory.

## Format

Tasks follow a checkbox format compatible with common Markdown parsers:

```markdown
- [ ] Task description
- [x] Completed task (skipped)
```

## Inline Metadata

Tasks can include inline metadata in backticks:

```markdown
- [ ] Implement feature `test: pytest tests/`
```

### Supported Metadata

| Key | Description | Example |
|-----|-------------|---------|
| `test` | Test command to run after task | `test: pytest tests/` |
| `model` | Specific model for this task | `model: gpt-4` |

## Examples

### Simple Task

```markdown
- [ ] Add user authentication
```

### Task with Test

```markdown
- [ ] Implement login endpoint `test: pytest tests/auth/`
```

### Multiple Tasks

```markdown
# Project TODO

## Backend
- [ ] Implement user registration `test: pytest tests/auth/`
- [ ] Add password reset `test: pytest tests/auth/`
- [ ] Create API endpoints `test: pytest tests/api/`

## Frontend
- [ ] Build login form
- [ ] Create registration page `test: npm run test:login`
- [ ] Style dashboard
```

## Validation

```bash
# Validate TODO.md format
opencode-orchestrator validate

# Or for automation
opencode-automation validate
```

## Task Lifecycle

1. **Parsed**: Extracted from TODO.md on automation start
2. **Pending**: In queue, not yet started
3. **In Progress**: Currently being worked on
4. **Completed**: Successfully finished
5. **Failed**: Failed after max retries

## Notes

- Completed tasks (`- [x]`) are automatically skipped
- Tasks are processed in order (top to bottom)
- The orchestrator updates task checkboxes in TODO.md as it completes them
