from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import os
from utils.logger import get_logger

logger = get_logger(__name__)
scheduler = AsyncIOScheduler()


def start_scheduler():
    interval_days = int(os.getenv("MODEL_RETRAIN_INTERVAL_DAYS", 7))
    scheduler.add_job(
        _retrain_job,
        trigger=IntervalTrigger(days=interval_days),
        id="weekly_retrain",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Scheduler started — retraining every {interval_days} days")


async def _retrain_job():
    logger.info("Scheduled retrain triggered...")
    try:
        from models.model_trainer import train_all_models
        result = await train_all_models()
        logger.info(f"Scheduled retrain complete: {result}")
    except Exception as e:
        logger.error(f"Scheduled retrain failed: {e}")