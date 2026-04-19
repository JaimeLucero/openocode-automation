"""Tests for TODO parser."""

import pytest
from pathlib import Path
from opencode_orchestrator.core.todo_parser import TodoParser, Task


class TestTodoParser:
    """Test TODO.md parsing."""

    @pytest.fixture
    def sample_todo(self, tmp_path):
        """Create a sample TODO.md file."""
        todo_content = """# Project Tasks

## Backend
- [ ] Implement auth `test: pytest tests/auth/`
- [ ] Add API endpoint
- [x] Setup project (completed)

## Frontend
- [ ] Create component `test: npm test`
"""
        todo_file = tmp_path / "TODO.md"
        todo_file.write_text(todo_content)
        return todo_file

    def test_parse_incomplete_tasks(self, sample_todo):
        """Test parsing incomplete tasks only."""
        parser = TodoParser(sample_todo)
        tasks = parser.get_incomplete_tasks()

        assert len(tasks) == 3

        # Check descriptions
        descriptions = [t.description for t in tasks]
        assert "Implement auth" in descriptions
        assert "Add API endpoint" in descriptions
        assert "Create component" in descriptions
        assert "Setup project" not in descriptions  # Completed

    def test_parse_inline_test_commands(self, sample_todo):
        """Test parsing inline test commands."""
        parser = TodoParser(sample_todo)
        tasks = parser.get_incomplete_tasks()

        # Find tasks with test commands
        auth_task = next((t for t in tasks if "auth" in t.description), None)
        component_task = next((t for t in tasks if "component" in t.description), None)
        api_task = next((t for t in tasks if "API" in t.description), None)

        assert auth_task is not None
        assert auth_task.test_command == "pytest tests/auth/"

        assert component_task is not None
        assert component_task.test_command == "npm test"

        assert api_task is not None
        assert api_task.test_command is None

    def test_mark_task_complete(self, sample_todo):
        """Test marking a task as complete."""
        parser = TodoParser(sample_todo)
        tasks = parser.get_incomplete_tasks()

        task = tasks[0]
        assert not task.completed

        parser.mark_task_complete(task)

        assert task.completed

        # Verify file was updated
        content = sample_todo.read_text()
        assert "- [x] " + task.description in content

    def test_validate_valid_todo(self, sample_todo):
        """Test validation of valid TODO.md."""
        parser = TodoParser(sample_todo)

        assert parser.is_valid()
        assert len(parser.validate()) == 0

    def test_validate_missing_file(self, tmp_path):
        """Test validation when file doesn't exist."""
        parser = TodoParser(tmp_path / "nonexistent.md")

        assert not parser.is_valid()
        issues = parser.validate()
        assert len(issues) > 0
        assert "not found" in issues[0].lower()

    def test_validate_empty_todo(self, tmp_path):
        """Test validation of empty TODO.md."""
        todo_file = tmp_path / "TODO.md"
        todo_file.write_text("# Empty\n")

        parser = TodoParser(todo_file)

        assert not parser.is_valid()
        issues = parser.validate()
        assert any("No tasks" in issue for issue in issues)
