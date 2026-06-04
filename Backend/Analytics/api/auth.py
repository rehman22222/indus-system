"""API authentication for the analytics service.

Endpoints expose per-patient risk (PHI) and a heavy `/train` job, so they must
not be open. This guard is env-gated: when ANALYTICS_API_KEY is set, every
request must send a matching `X-API-Key` header; when it is unset (local dev),
the guard is a no-op so development isn't blocked. Always set the env var in any
shared or production deployment.
"""

import os
from typing import Optional

from fastapi import Header, HTTPException, status


def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    expected = os.getenv("ANALYTICS_API_KEY", "").strip()
    if not expected:
        # No key configured -> open (dev only). Configure ANALYTICS_API_KEY to
        # lock the API down in any deployed environment.
        return
    if not x_api_key or x_api_key.strip() != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )
