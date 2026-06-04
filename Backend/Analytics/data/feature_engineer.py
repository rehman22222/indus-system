import pandas as pd
import numpy as np
from utils.logger import get_logger

logger = get_logger(__name__)

# NOTE: features must be knowable at prediction time and must NOT encode the
# target (is_no_show). "no_show_risk_score" is the DB's precomputed no-show risk
# and leaks the outcome, so it is deliberately excluded here.
FEATURE_COLS = [
    "month", "day_of_week", "week_of_year", "is_weekend",
    "hour", "is_video", "lead_days", "specialty_enc",
    "age", "age_group_enc",
]


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    logger.info("Engineering features...")

    # Patient history features
    patient_history = (
        df.groupby("patient_id")
        .agg(
            total_visits=("id", "count"),
            no_show_count=("is_no_show", "sum"),
            completion_rate=("is_completed", "mean"),
            avg_lead_days=("lead_days", "mean"),
        )
        .reset_index()
    )
    patient_history["no_show_rate"] = (
        patient_history["no_show_count"] / patient_history["total_visits"]
    ).fillna(0)

    df = df.merge(patient_history, on="patient_id", how="left")

    # Doctor load features
    doctor_load = (
        df.groupby(["doctor_id", "appointment_date"])
        .agg(daily_appointments=("id", "count"))
        .reset_index()
    )
    df = df.merge(doctor_load, on=["doctor_id", "appointment_date"], how="left")

    # Specialty monthly volume
    specialty_vol = (
        df.groupby(["specialty", "year", "month"])
        .agg(specialty_monthly_vol=("id", "count"))
        .reset_index()
    )
    df = df.merge(specialty_vol, on=["specialty", "year", "month"], how="left")

    for col in ["total_visits", "no_show_count", "daily_appointments",
                "specialty_monthly_vol", "avg_lead_days"]:
        df[col] = df[col].fillna(0)

    logger.info(f"Feature engineering complete. Shape: {df.shape}")
    return df


def get_feature_matrix(df: pd.DataFrame) -> tuple:
    # "no_show_rate" and "completion_rate" are aggregated from is_no_show /
    # is_completed over the patient's full history (including the row being
    # scored), so they leak the target — excluded from the model inputs. They
    # remain available on the dataframe for display/reporting only.
    extended_features = FEATURE_COLS + [
        "total_visits",
        "avg_lead_days", "daily_appointments", "specialty_monthly_vol",
    ]
    available = [c for c in extended_features if c in df.columns]
    X = df[available].fillna(0)
    y = df["is_no_show"] if "is_no_show" in df.columns else None
    return X, y