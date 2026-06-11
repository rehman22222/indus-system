from fastapi import FastAPI, Request
from utils.logger import get_logger
import time

logger = get_logger(__name__)

def add_middleware(app: FastAPI):
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration = round((time.time() - start) * 1000, 2)
        logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({duration}ms)")
        return response
