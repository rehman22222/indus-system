import pandas as pd
import numpy as np
from typing import Optional
import os
import joblib
from utils.logger import get_logger
from data.data_loader import load_patient_data
from data.data_preprocessor import preprocess

logger = get_logger(__name__)
MODEL_PATH = "saved_models/prophet_forecast.pkl"


async def forecast_patient_volume(
    periods: int = 12,
    specialty: Optional[str] = None,
) -> dict:
    logger.info(f"Forecasting patient volume for {periods} months...")

    df_raw = await load_patient_data(limit=500_000)
    if df_raw.is_empty():
        return {
            "specialty": specialty or "all",
            "forecast_months": periods,
            "historical": [],
            "forecast": [],
            "model": "prophet",
            "accuracy_note": "No data available",
        }

    df = preprocess(df_raw)

    if specialty:
        df = df[df["specialty"] == specialty]

    # Aggregate monthly
    monthly = (
        df.groupby(["year", "month"])
        .agg(patient_count=("id", "count"))
        .reset_index()
    )
    monthly["ds"] = pd.to_datetime(
        monthly[["year", "month"]].assign(day=1)
    )
    monthly = monthly.rename(columns={"patient_count": "y"})
    monthly = monthly[["ds", "y"]].sort_values("ds")

    if len(monthly) < 6:
        logger.warning("Insufficient data for Prophet. Using statistical forecast.")
        return _statistical_forecast(monthly, periods)

    try:
        from prophet import Prophet

        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False,
            seasonality_mode="multiplicative",
            interval_width=0.95,
        )
        model.fit(monthly)
        joblib.dump(model, MODEL_PATH)

        future = model.make_future_dataframe(periods=periods, freq="MS")
        forecast = model.predict(future)

        future_only = forecast[forecast["ds"] > monthly["ds"].max()].copy()

        return {
            "specialty": specialty or "all",
            "forecast_months": periods,
            "historical": [
                {"month": row["ds"].strftime("%Y-%m"), "actual": int(row["y"])}
                for _, row in monthly.iterrows()
            ],
            "forecast": [
                {
                    "month": row["ds"].strftime("%Y-%m"),
                    "predicted": max(0, int(row["yhat"])),
                    "lower": max(0, int(row["yhat_lower"])),
                    "upper": max(0, int(row["yhat_upper"])),
                    "trend": "up" if row["yhat"] > monthly["y"].iloc[-1] else "down",
                }
                for _, row in future_only.iterrows()
            ],
            "model": "prophet",
            "accuracy_note": "95% confidence interval shown",
        }

    except Exception as e:
        logger.error(f"Prophet failed: {e}. Falling back to statistical method.")
        return _statistical_forecast(monthly, periods)


def _statistical_forecast(monthly: pd.DataFrame, periods: int) -> dict:
    if len(monthly) == 0:
        return {
            "specialty": "all",
            "forecast_months": periods,
            "historical": [],
            "forecast": [],
            "model": "statistical_fallback",
            "accuracy_note": "No data available",
        }

    avg = monthly["y"].mean()
    std = monthly["y"].std() or avg * 0.1
    trend = (monthly["y"].iloc[-1] - monthly["y"].iloc[0]) / max(len(monthly), 1)
    last_date = monthly["ds"].max()

    forecast = []
    for i in range(1, periods + 1):
        month_date = last_date + pd.DateOffset(months=i)
        predicted = max(0, avg + trend * i)
        forecast.append({
            "month": month_date.strftime("%Y-%m"),
            "predicted": int(predicted),
            "lower": max(0, int(predicted - 1.96 * std)),
            "upper": int(predicted + 1.96 * std),
            "trend": "up" if trend > 0 else "down",
        })

    return {
        "specialty": "all",
        "forecast_months": periods,
        "historical": [
            {"month": r["ds"].strftime("%Y-%m"), "actual": int(r["y"])}
            for _, r in monthly.iterrows()
        ],
        "forecast": forecast,
        "model": "statistical_fallback",
        "accuracy_note": "Statistical trend extrapolation",
    }