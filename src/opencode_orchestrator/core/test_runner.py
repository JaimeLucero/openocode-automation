"""Test runner for npm and pytest."""

import subprocess
from pathlib import Path
from typing import Optional, Tuple, List
from dataclasses import dataclass
import json


@dataclass
class TestResult:
    """Result of running tests."""

    success: bool
    stdout: str
    stderr: str
    return_code: int
    runner: str  # 'npm', 'pytest', or 'custom'


class TestRunner:
    """Detects and runs tests for a project."""

    # Detection rules
    DETECTION_RULES = {
        "npm": {
            "files": ["package.json"],
            "default_cmd": "npm test",
        },
        "pytest": {
            "files": ["pytest.ini", "setup.py", "pyproject.toml", "setup.cfg"],
            "dirs": ["tests", "test"],
            "default_cmd": "pytest",
        },
    }

    def __init__(self, project_dir: Path):
        self.project_dir = Path(project_dir)

    def detect_runner(self) -> Optional[str]:
        """Auto-detect the test runner based on project structure.

        Returns 'npm', 'pytest', or None if cannot detect.
        """
        # Check for npm
        if self._has_files(self.DETECTION_RULES["npm"]["files"]):
            return "npm"

        # Check for pytest
        if self._has_files(self.DETECTION_RULES["pytest"]["files"]) or self._has_dirs(
            self.DETECTION_RULES["pytest"]["dirs"]
        ):
            return "pytest"

        return None

    def run(self, command: Optional[str] = None) -> TestResult:
        """Run tests for the project.

        Args:
            command: Optional explicit test command. If None, auto-detect.

        Returns:
            TestResult with success status and output
        """
        if command:
            # Use explicit command
            return self._run_command(command, "custom")

        # Auto-detect
        runner = self.detect_runner()

        if runner == "npm":
            return self._run_npm()
        elif runner == "pytest":
            return self._run_pytest()
        else:
            return TestResult(
                success=False,
                stdout="",
                stderr="Could not detect test runner. Please specify test command in TODO.md",
                return_code=-1,
                runner="unknown",
            )

    def _run_npm(self) -> TestResult:
        """Run npm tests."""
        return self._run_command("npm test", "npm")

    def _run_pytest(self) -> TestResult:
        """Run pytest."""
        return self._run_command("pytest", "pytest")

    def _run_command(self, command: str, runner: str) -> TestResult:
        """Run a test command."""
        try:
            # Use shell=True for complex commands
            use_shell = "&&" in command or "||" in command or "|" in command

            result = subprocess.run(
                command if use_shell else command.split(),
                capture_output=True,
                text=True,
                cwd=self.project_dir,
                shell=use_shell,
                timeout=300,  # 5 minute timeout for tests
            )

            return TestResult(
                success=result.returncode == 0,
                stdout=result.stdout,
                stderr=result.stderr,
                return_code=result.returncode,
                runner=runner,
            )

        except subprocess.TimeoutExpired:
            return TestResult(
                success=False,
                stdout="",
                stderr="Test execution timed out after 5 minutes",
                return_code=-1,
                runner=runner,
            )
        except Exception as e:
            return TestResult(
                success=False,
                stdout="",
                stderr=f"Error running tests: {str(e)}",
                return_code=-1,
                runner=runner,
            )

    def _has_files(self, filenames: List[str]) -> bool:
        """Check if any of the files exist in project directory."""
        for filename in filenames:
            if (self.project_dir / filename).exists():
                return True
        return False

    def _has_dirs(self, dirnames: List[str]) -> bool:
        """Check if any of the directories exist in project directory."""
        for dirname in dirnames:
            if (self.project_dir / dirname).is_dir():
                return True
        return False

    def get_available_commands(self) -> List[str]:
        """Get list of available test commands based on project type."""
        commands = []

        if self.detect_runner() == "npm":
            commands.append("npm test")
            # Check package.json for other scripts
            package_json = self.project_dir / "package.json"
            if package_json.exists():
                try:
                    with open(package_json) as f:
                        data = json.load(f)
                        scripts = data.get("scripts", {})
                        for name in scripts:
                            if "test" in name.lower():
                                commands.append(f"npm run {name}")
                except json.JSONDecodeError:
                    pass

        if self.detect_runner() == "pytest":
            commands.append("pytest")
            commands.append("pytest -v")

        return commands
