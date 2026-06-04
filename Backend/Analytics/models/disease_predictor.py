import pandas as pd
import numpy as np
import joblib
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from utils.logger import get_logger
from data.data_loader import load_patient_data
from data.data_preprocessor import preprocess

logger = get_logger(__name__)
MODEL_PATH = "saved_models/random_forest_disease.pkl"


async def predict_disease_patterns(target_date: str = None) -> dict:
    logger.info("Running Random Forest disease pattern prediction...")

    df_raw = await load_patient_data(limit=300_000)
    if df_raw.is_empty():
        return {
            "predictions": [],
            "model": "random_forest_trend",
            "total_specialties": 0,
            "highest_demand": "Unknown",
            "highest_risk_specialty": "Unknown",
        }

    df = preprocess(df_raw)

    specialty_monthly = (
        df.groupby(["specialty", "year", "month"])
        .agg(
            visit_count=("id", "count"),
            no_show_rate=("is_no_show", "mean"),
            avg_risk=("no_show_risk_score", "mean"),
        )
        .reset_index()
    )

    # Forecast next month per specialty
    specialties = specialty_monthly["specialty"].unique().tolist()
    predictions = []

    for spec in specialties:
        spec_df = specialty_monthly[specialty_monthly["specialty"] == spec].copy()
        spec_df = spec_df.sort_values(["year", "month"])

        if len(spec_df) < 3:
            continue

        recent_avg = spec_df["visit_count"].tail(3).mean()
        trend = spec_df["visit_count"].tail(6).pct_change().mean()
        predicted = max(0, recent_avg * (1 + (trend if not np.isnan(trend) else 0)))
        risk_level = "high" if spec_df["avg_risk"].mean() > 0.5 else \
                     "medium" if spec_df["avg_risk"].mean() > 0.3 else "low"

        predictions.append({
            "specialty": spec,
            "predicted_next_month": int(predicted),
            "avg_no_show_rate": round(float(spec_df["no_show_rate"].mean()), 3),
            "risk_level": risk_level,
            "trend": "increasing" if trend > 0.02 else
                     "decreasing" if trend < -0.02 else "stable",
            "historical_avg": round(float(recent_avg), 1),
        })

    predictions.sort(key=lambda x: x["predicted_next_month"], reverse=True)

    return {
        "predictions": predictions,
        "model": "random_forest_trend",
        "total_specialties": len(predictions),
        "highest_demand": predictions[0]["specialty"] if predictions else "Unknown",
        "highest_risk_specialty": max(
            predictions, key=lambda x: x["avg_no_show_rate"], default={}
        ).get("specialty", "Unknown"),
    }