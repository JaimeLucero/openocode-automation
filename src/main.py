"""FastAPI entry point for OpenCode Orchestrator."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import automation, sessions, tickets
from config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    yield


app = FastAPI(
    title="OpenCode Orchestrator API",
    description="API for orchestrating OpenCode automation",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(automation.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(tickets.router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "OpenCode Orchestrator API", "version": "1.0.0"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
