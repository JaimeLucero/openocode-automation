"""Tests for configuration module."""

import pytest
from pathlib import Path
from opencode_orchestrator.config import Config, OpenCodeConfig


class TestConfig:
    """Test configuration management."""

    def test_default_config(self):
        """Test default configuration values."""
        config = Config()

        assert config.opencode.model == "kimi-k2.5"
        assert config.orchestrator.max_retries == 3
        assert config.orchestrator.timeout == 300
        assert config.telegram.enabled is False

    def test_model_validation(self):
        """Test that only available models are valid."""
        config = Config()

        # Valid model
        config.opencode.model = "gpt-4"
        assert len(config.validate()) == 0

        # Invalid model
        config.opencode.model = "invalid-model"
        errors = config.validate()
        assert len(errors) > 0
        assert "Invalid model" in errors[0]

    def test_available_models(self):
        """Test that available models list is populated."""
        config = Config()

        expected_models = [
            "kimi-k2.5",
            "gpt-4",
            "gpt-4-turbo",
            "claude-3-opus",
            "claude-3-sonnet",
            "glm-4",
            "glm-3-turbo",
        ]

        assert config.opencode.AVAILABLE_MODELS == expected_models
