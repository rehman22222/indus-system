import polars as pl
import pandas as pd
import numpy as np
from utils.logger import get_logger

logger = get_logger(__name__)


def preprocess(df: pl.DataFrame) -> pd.DataFrame:
    logger.info("Preprocessing data...")

    pdf = df.to_pandas()

    # Parse dates
    pdf["appointment_date"] = pd.to_datetime(pdf["appointment_date"], errors="coerce")
    pdf["created_at"] = pd.to_datetime(pdf["created_at"], errors="coerce")
    pdf["dob"] = pd.to_datetime(pdf["dob"], errors="coerce")

    # Derive features
    pdf["year"] = pdf["appointment_date"].dt.year
    pdf["month"] = pdf["appointment_date"].dt.month
    pdf["day_of_week"] = pdf["appointment_date"].dt.dayofweek
    pdf["week_of_year"] = pdf["appointment_date"].dt.isocalendar().week.astype(int)
    pdf["is_weekend"] = pdf["day_of_week"].isin([5, 6]).astype(int)
    pdf["hour"] = pdf["appointment_time"].str.split(":").str[0].astype(float)
    pdf["is_no_show"] = (pdf["status"] == "no_show").astype(int)
    pdf["is_completed"] = (pdf["status"] == "completed").astype(int)
    pdf["is_video"] = (pdf["appointment_type"] == "video").astype(int)

    # Patient age
    ref_date = pd.Timestamp.now()
    pdf["age"] = ((ref_date - pdf["dob"]).dt.days / 365.25).fillna(35).clip(0, 120)
    pdf["age_group"] = pd.cut(
        pdf["age"],
        bins=[0, 12, 18, 30, 45, 60, 75, 120],
        labels=["child", "teen", "young_adult", "adult", "middle_aged", "senior", "elderly"],
    )

    # Lead time (days between booking and appointment)
    pdf["lead_days"] = (pdf["appointment_date"] - pdf["created_at"]).dt.days.clip(0, 365)

    # Encode categoricals
    pdf["specialty_enc"] = pd.Categorical(pdf["specialty"]).codes
    pdf["appointment_type_enc"] = (pdf["appointment_type"] == "video").astype(int)
    pdf["age_group_enc"] = pd.Categorical(pdf["age_group"]).codes

    pdf = pdf.dropna(subset=["appointment_date"])
    logger.info(f"Preprocessing complete. Shape: {pdf.shape}")
    return pdf