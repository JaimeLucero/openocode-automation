"""Test configuration and fixtures."""

import pytest
from pathlib import Path


@pytest.fixture
def temp_project(tmp_path):
    """Create a temporary project directory with necessary files."""
    # Create TODO.md
    todo = tmp_path / "TODO.md"
    todo.write_text(
        """# Test Tasks
- [ ] Task 1 `test: echo test`
- [ ] Task 2
"""
    )

    return tmp_path


@pytest.fixture
def mock_config(temp_project, monkeypatch):
    """Create a mock configuration for testing."""
    from opencode_orchestrator.config import Config

    config = Config(project_dir=temp_project)
    config.telegram.enabled = False  # Disable Telegram for tests

    return config
