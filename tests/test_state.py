"""Tests for state persistence."""

import pytest
from datetime import datetime
from pathlib import Path
from opencode_orchestrator.state.persistence import OrchestratorState, Task, StateManager


class TestStatePersistence:
    """Test compressed state persistence."""

    @pytest.fixture
    def state_manager(self, tmp_path):
        """Create a state manager with temp file."""
        return StateManager(tmp_path / ".opencode_state.bin")

    @pytest.fixture
    def sample_state(self):
        """Create a sample state object."""
        state = OrchestratorState(
            current_task_index=1,
            status="EXECUTING",
            tasks=[
                Task(line_number=1, description="Task 1", completed=True, attempts=1),
                Task(line_number=2, description="Task 2", completed=False, attempts=2),
            ],
        )
        state.retry_counts["Task 2"] = 2
        state.last_error = "Test error"
        return state

    def test_save_and_load_state(self, state_manager, sample_state):
        """Test saving and loading state."""
        # Save
        state_manager.save(sample_state)
        assert state_manager.exists()

        # Load
        loaded = state_manager.load()
        assert loaded is not None

        # Verify data integrity
        assert loaded.current_task_index == sample_state.current_task_index
        assert loaded.status == sample_state.status
        assert len(loaded.tasks) == len(sample_state.tasks)
        assert loaded.retry_counts == sample_state.retry_counts
        assert loaded.last_error == sample_state.last_error

    def test_state_timestamps(self, state_manager, sample_state):
        """Test that timestamps are preserved."""
        before_save = datetime.utcnow()
        state_manager.save(sample_state)

        loaded = state_manager.load()

        assert loaded.created_at is not None
        assert loaded.updated_at is not None
        assert loaded.created_at <= loaded.updated_at

    def test_mark_complete(self, state_manager, sample_state):
        """Test marking state as complete."""
        state_manager.save(sample_state)

        loaded = state_manager.load()
        loaded.mark_complete()
        state_manager.save(loaded)

        completed = state_manager.load()
        assert completed.status == "FINISHED"
        assert completed.completed_at is not None

    def test_archive_state(self, state_manager, sample_state):
        """Test archiving state file."""
        state_manager.save(sample_state)

        archive_path = state_manager.archive()

        assert archive_path is not None
        assert archive_path.exists()
        assert archive_path != state_manager.state_file
        assert ".opencode_state_" in archive_path.name

    def test_load_nonexistent_state(self, state_manager):
        """Test loading when state file doesn't exist."""
        loaded = state_manager.load()
        assert loaded is None

    def test_delete_state(self, state_manager, sample_state):
        """Test deleting state file."""
        state_manager.save(sample_state)
        assert state_manager.exists()

        state_manager.delete()
        assert not state_manager.exists()
