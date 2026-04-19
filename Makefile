.PHONY: help install install-dev install-server test test-cov format lint type-check clean build dist run-server venv setup electron electron-dev electron-build electron-package

VENV := venv
PYTHON := python3

help:
	@echo "OpenCode Orchestrator - Available Commands:"
	@echo ""
	@echo "FastAPI Server:"
	@echo "  make setup         - Create venv and install dependencies"
	@echo "  make run-server   - Start FastAPI server"
	@echo ""
	@echo "Electron App:"
	@echo "  make electron     - Install Electron dependencies"
	@echo "  make electron-dev  - Run Electron in development mode"
	@echo "  make electron-build - Build Electron app"
	@echo "  make electron-package - Package Electron app for distribution"
	@echo ""
	@echo "Development:"
	@echo "  make install      - Install package in development mode"
	@echo "  make install-dev  - Install with dev dependencies"
	@echo "  make test        - Run tests"
	@echo "  make test-cov    - Run tests with coverage"
	@echo "  make format     - Format code with ruff"
	@echo "  make lint       - Lint code"
	@echo "  make type-check - Run type checker"
	@echo ""
	@echo "Building:"
	@echo "  make clean       - Clean build artifacts"
	@echo "  make build      - Build package"
	@echo ""
	@echo "After setup, add your Neon connection string to src/.env"

venv:
	cd src && $(PYTHON) -m venv $(VENV)

setup: venv
	cd src && $(VENV)/bin/pip install --upgrade pip
	cd src && $(VENV)/bin/pip install -r requirements.txt
	@cp -n src/.env.example src/.env 2>/dev/null || true
	@echo "Setup complete! Edit src/.env with your Neon connection string."

install: setup
	cd src && $(VENV)/bin/pip install -e .

install-dev: setup
	cd src && $(VENV)/bin/pip install -e ".[dev]"

install-server: setup
	cd src && $(VENV)/bin/pip install -e ".[server]"

test:
	cd src && $(VENV)/bin/pytest tests/ -v

test-cov:
	cd src && $(VENV)/bin/pytest tests/ -v --cov=opencode_orchestrator --cov-report=term-missing --cov-report=html

format:
	cd src && $(VENV)/bin/ruff check src/ --fix
	cd src && $(VENV)/bin/black src/

lint:
	cd src && $(VENV)/bin/ruff check src/

type-check:
	cd src && $(VENV)/bin/mypy src/

clean:
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info/
	rm -rf .pytest_cache/
	rm -rf .mypy_cache/
	rm -rf htmlcov/
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

build: clean
	cd src && $(VENV)/bin/python -m build

dist: build
	cd src && $(VENV)/bin/twine check dist/*

publish-test: dist
	cd src && $(VENV)/bin/twine upload --repository testpypi dist/*

publish: dist
	cd src && $(VENV)/bin/twine upload dist/*

run-server: venv
	cd src && $(VENV)/bin/python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

dev-setup: install-dev install-server
	cd src && $(VENV)/bin/pip install -e ".[dev,server]"

electron:
	cd electron && npm install

electron-dev:
	cd electron && npm run dev

electron-build:
	cd electron && npm run build

electron-package:
	cd electron && npm run package

.PHONY: help install install-dev install-server test test-cov format lint type-check clean build dist run-server venv setup electron electron-dev electron-build electron-package