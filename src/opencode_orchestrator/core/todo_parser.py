"""TODO.md parser with inline test command support."""

import re
from pathlib import Path
from typing import List, Optional, Dict
from dataclasses import dataclass


@dataclass
class Task:
    """Represents a single task from TODO.md."""

    line_number: int
    description: str
    test_command: Optional[str] = None
    model: Optional[str] = None  # Per-task model override
    completed: bool = False
    attempts: int = 0

    @property
    def is_incomplete(self) -> bool:
        """Check if task is not completed."""
        return not self.completed


class TodoParser:
    """Parses TODO.md files and extracts tasks."""

    # Match incomplete tasks: - [ ] description `metadata`
    # Also captures inline metadata in backticks
    TASK_PATTERN = re.compile(r"^- \[([ x])\]\s+(.+?)(?:\s+`([^`]+)`)?\s*$", re.MULTILINE)

    # Parse inline metadata like: test: npm test, model: gpt-4
    METADATA_PATTERN = re.compile(r"(\w+):\s*([^,]+)")

    def __init__(self, todo_path: Path):
        self.todo_path = Path(todo_path)

    def parse(self) -> List[Task]:
        """Parse the TODO.md file and extract all tasks.

        Returns a list of Task objects for incomplete tasks.
        """
        if not self.todo_path.exists():
            raise FileNotFoundError(f"TODO file not found: {self.todo_path}")

        content = self.todo_path.read_text()
        tasks = []

        for match in self.TASK_PATTERN.finditer(content):
            checkbox = match.group(1)
            description = match.group(2).strip()
            metadata_str = match.group(3)

            # Calculate line number
            line_number = content[: match.start()].count("\n") + 1

            # Check if completed
            completed = checkbox == "x"

            # Parse metadata
            test_command = None
            model = None

            if metadata_str:
                metadata = self._parse_metadata(metadata_str)
                test_command = metadata.get("test")
                model = metadata.get("model")

            task = Task(
                line_number=line_number,
                description=description,
                test_command=test_command,
                model=model,
                completed=completed,
            )
            tasks.append(task)

        return tasks

    def get_incomplete_tasks(self) -> List[Task]:
        """Get only incomplete tasks."""
        return [task for task in self.parse() if not task.completed]

    def mark_task_complete(self, task: Task) -> None:
        """Mark a task as complete in the TODO.md file.

        Modifies the file in place, changing - [ ] to - [x].
        """
        if not self.todo_path.exists():
            raise FileNotFoundError(f"TODO file not found: {self.todo_path}")

        lines = self.todo_path.read_text().split("\n")

        if task.line_number < 1 or task.line_number > len(lines):
            raise ValueError(f"Invalid line number: {task.line_number}")

        line_idx = task.line_number - 1
        line = lines[line_idx]

        # Replace - [ ] with - [x]
        if "- [ ]" in line:
            lines[line_idx] = line.replace("- [ ]", "- [x]", 1)
            self.todo_path.write_text("\n".join(lines))
            task.completed = True

    def _parse_metadata(self, metadata_str: str) -> Dict[str, str]:
        """Parse inline metadata string.

        Example: "test: npm test, model: gpt-4" -> {"test": "npm test", "model": "gpt-4"}
        """
        metadata = {}

        # Check if it's a simple test command (starts with test:)
        if metadata_str.strip().startswith("test:"):
            # Simple format: `test: command`
            parts = metadata_str.split(":", 1)
            if len(parts) == 2:
                metadata["test"] = parts[1].strip()
        else:
            # Complex format with multiple fields: `test: cmd, model: mdl`
            for key, value in self.METADATA_PATTERN.findall(metadata_str):
                metadata[key.strip()] = value.strip()

        return metadata

    def validate(self) -> List[str]:
        """Validate the TODO.md file and return list of issues."""
        issues = []

        if not self.todo_path.exists():
            issues.append(f"File not found: {self.todo_path}")
            return issues

        content = self.todo_path.read_text()

        # Check for tasks
        tasks = self.parse()
        incomplete = [t for t in tasks if not t.completed]

        if not tasks:
            issues.append("No tasks found in TODO.md")
        elif not incomplete:
            issues.append("All tasks are already completed")

        # Check for malformed lines that look like tasks
        lines = content.split("\n")
        for i, line in enumerate(lines, 1):
            if "- [" in line and not self.TASK_PATTERN.match(line):
                issues.append(f"Line {i} looks like a task but is malformed: {line.strip()}")

        return issues

    def is_valid(self) -> bool:
        """Check if TODO.md is valid."""
        return len(self.validate()) == 0
