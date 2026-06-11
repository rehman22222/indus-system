from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from api.routes import router
from api.auth import require_api_key
from api.middleware import add_middleware
from realtime_dashboard.websocket_manager import websocket_router
from scheduler.retrain_scheduler import start_scheduler

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield

app = FastAPI(
    title="Smart Care Hub — Analytics API",
    description="Predictive analytics for Indus Hospital patient data",
    version="1.0.0",
    lifespan=lifespan,
)

DEFAULT_CORS_ORIGINS = ",".join([
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:5173",
])
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

add_middleware(app)
# Guard every /api route with the env-gated API key (no-op when unset).
app.include_router(router, prefix="/api", dependencies=[Depends(require_api_key)])
app.include_router(websocket_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "Smart Care Hub Analytics"}
