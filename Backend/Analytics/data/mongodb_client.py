import os
from pymongo import MongoClient
from dotenv import load_dotenv
from utils.logger import get_logger

load_dotenv()
logger = get_logger(__name__)

_client: MongoClient | None = None


def get_mongo_db():
    global _client

    uri = os.getenv("MONGODB_URI", "")
    db_name = os.getenv("MONGODB_DB_NAME", "doctorappointment")
    if not uri:
        raise RuntimeError("MONGODB_URI must be set in the analytics .env")

    if _client is None:
        _client = MongoClient(
            uri,
            serverSelectionTimeoutMS=10000,
            maxPoolSize=int(os.getenv("MONGODB_MAX_POOL_SIZE", "20")),
        )
        _client.admin.command("ping")
        logger.info("MongoDB analytics client initialized")

    return _client[db_name]
