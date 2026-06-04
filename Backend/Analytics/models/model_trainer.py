import os
from utils.logger import get_logger
from data.data_loader import load_patient_data
from data.data_preprocessor import preprocess
from data.feature_engineer import build_features, get_feature_matrix

logger = get_logger(__name__)


async def train_all_models() -> dict:
    logger.info("Starting full model training pipeline...")
    os.makedirs("saved_models", exist_ok=True)

    results = {}

    df_raw = await load_patient_data(limit=1_000_000)
    if df_raw.is_empty():
        return {"error": "No data available for training"}

    df = preprocess(df_raw)
    df_feat = build_features(df)
    X, y = get_feature_matrix(df_feat)

    # Train XGBoost
    try:
        from models.risk_predictor import _train as train_xgb
        train_xgb(X, y)
        results["xgboost"] = "trained"
        logger.info("XGBoost training complete")
    except Exception as e:
        results["xgboost"] = f"failed: {e}"

    # Train Prophet
    try:
        await _train_prophet(df)
        results["prophet"] = "trained"
        logger.info("Prophet training complete")
    except Exception as e:
        results["prophet"] = f"failed: {e}"

    results["total_records"] = len(df)
    results["timestamp"] = str(__import__("datetime").datetime.now())
    logger.info(f"Training complete: {results}")
    return results


async def _train_prophet(df):
    import pandas as pd
    import joblib
    from prophet import Prophet

    monthly = (
        df.groupby(["year", "month"])
        .agg(y=("id", "count"))
        .reset_index()
    )
    monthly["ds"] = pd.to_datetime(monthly[["year", "month"]].assign(day=1))
    monthly = monthly[["ds", "y"]].sort_values("ds")

    if len(monthly) < 6:
        raise ValueError("Not enough monthly data for Prophet")

    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_mode="multiplicative",
        interval_width=0.95,
    )
    model.fit(monthly)
    joblib.dump(model, "saved_models/prophet_forecast.pkl")