"""OpenCode CLI executor with model support."""

import os
import subprocess
from pathlib import Path
from typing import Optional, Tuple
from dataclasses import dataclass

from opencode_orchestrator.core.todo_parser import Task


@dataclass
class ExecutionResult:
    """Result of executing OpenCode."""

    success: bool
    stdout: str
    stderr: str
    return_code: int
    duration: float  # seconds


class OpenCodeExecutor:
    """Executes OpenCode CLI commands."""

    def __init__(self, model: str, timeout: int = 300):
        self.model = model
        self.timeout = timeout

    def execute(self, task: Task, previous_error: Optional[str] = None) -> ExecutionResult:
        """Execute OpenCode with the given task.

        Args:
            task: The task to implement
            previous_error: Error from previous attempt (for retry)

        Returns:
            ExecutionResult with success status and output
        """
        prompt = self._build_prompt(task, previous_error)

        # Prepare environment with model setting
        env = os.environ.copy()
        env["OPENCODE_MODEL"] = task.model or self.model

        try:
            import time

            start_time = time.time()

            result = subprocess.run(
                ["opencode", prompt],
                capture_output=True,
                text=True,
                timeout=self.timeout,
                env=env,
                cwd=os.getcwd(),
            )

            duration = time.time() - start_time

            return ExecutionResult(
                success=result.returncode == 0,
                stdout=result.stdout,
                stderr=result.stderr,
                return_code=result.returncode,
                duration=duration,
            )

        except subprocess.TimeoutExpired:
            return ExecutionResult(
                success=False,
                stdout="",
                stderr=f"OpenCode execution timed out after {self.timeout} seconds",
                return_code=-1,
                duration=self.timeout,
            )
        except FileNotFoundError:
            return ExecutionResult(
                success=False,
                stdout="",
                stderr="OpenCode CLI not found. Please install opencode.",
                return_code=-1,
                duration=0.0,
            )
        except Exception as e:
            return ExecutionResult(
                success=False,
                stdout="",
                stderr=f"Error executing OpenCode: {str(e)}",
                return_code=-1,
                duration=0.0,
            )

    def _build_prompt(self, task: Task, previous_error: Optional[str] = None) -> str:
        """Build the prompt for OpenCode."""
        base_prompt = f"""You are an autonomous developer implementing tasks from a TODO list.

Task: {task.description}

Requirements:
- Implement the task exactly as described
- Write or modify files directly in the project
- Follow existing code patterns and conventions
- Run tests to verify your implementation if available
- Do not ask questions, work autonomously
- Output 'DONE' when finished

Project context:
- Working directory: {os.getcwd()}
- Model: {task.model or self.model}
"""

        if task.test_command:
            base_prompt += f"- Test command: {task.test_command}\n"

        if previous_error:
            base_prompt += f"""

Previous attempt failed with this error:
{previous_error}

Please fix the issue. Focus on the failing functionality while preserving working code.
"""

        return base_prompt
