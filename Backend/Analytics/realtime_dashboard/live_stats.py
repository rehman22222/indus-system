from data.data_loader import get_live_stats
from utils.logger import get_logger
import pandas as pd

logger = get_logger(__name__)


async def get_current_stats() -> dict:
    try:
        stats = await get_live_stats()
        stats["timestamp"] = pd.Timestamp.now().isoformat()
        stats["source"] = "live"
        return stats
    except Exception as e:
        logger.warning(f"Live stats failed: {e}")
        return {
            "timestamp": pd.Timestamp.now().isoformat(),
            "source": "fallback",
            "today": {
                "total": 0, "confirmed": 0,
                "completed": 0, "no_shows": 0, "no_show_rate": 0,
            },
            "totals": {
                "all_appointments": 0,
                "total_patients": 0,
                "active_doctors": 0,
            },
        }