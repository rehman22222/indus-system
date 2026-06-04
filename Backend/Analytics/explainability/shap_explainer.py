import pandas as pd
import numpy as np
import joblib
import os
import shap
from utils.logger import get_logger
from data.data_loader import load_patient_data
from data.data_preprocessor import preprocess
from data.feature_engineer import build_features, get_feature_matrix

logger = get_logger(__name__)


async def get_shap_explanation(patient_id: str) -> dict:
    logger.info(f"Generating SHAP explanation for patient: {patient_id}")

    MODEL_PATH = "saved_models/xgboost_risk.pkl"
    SCALER_PATH = "saved_models/xgboost_scaler.pkl"

    if not os.path.exists(MODEL_PATH):
        return {
            "patient_id": patient_id,
            "error": "Model not trained yet. Run /api/train first.",
        }

    df_raw = await load_patient_data(limit=50_000)
    if df_raw.is_empty():
        return {"patient_id": patient_id, "error": "No data available"}

    df = preprocess(df_raw)
    df = build_features(df)
    patient_df = df[df["patient_id"] == patient_id]

    if patient_df.empty:
        return {
            "patient_id": patient_id,
            "error": "Patient not found in dataset",
        }

    X, _ = get_feature_matrix(df)
    patient_X, _ = get_feature_matrix(patient_df)

    model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)

    # Guard against a stale model whose feature set no longer matches the
    # current pipeline (avoids a 500 in scaler.transform after a feature change).
    expected = getattr(scaler, "n_features_in_", None)
    if expected is not None and expected != X.shape[1]:
        return {
            "patient_id": patient_id,
            "error": "Model is out of date. Run /api/train to retrain.",
        }

    X_scaled = scaler.transform(X.fillna(0))
    patient_scaled = scaler.transform(patient_X.fillna(0))

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(patient_scaled)

    risk_score = float(model.predict_proba(patient_scaled)[0, 1])
    feature_names = patient_X.columns.tolist()

    shap_row = shap_values[0] if len(shap_values.shape) > 1 else shap_values
    contributions = sorted(
        zip(feature_names, shap_row),
        key=lambda x: abs(x[1]),
        reverse=True,
    )[:8]

    return {
        "patient_id": patient_id,
        "risk_score": round(risk_score, 3),
        "risk_label": "high" if risk_score >= 0.6 else
                      "medium" if risk_score >= 0.35 else "low",
        "explanation": [
            {
                "feature": feat,
                "shap_value": round(float(val), 4),
                "direction": "increases_risk" if val > 0 else "decreases_risk",
                "feature_value": round(float(patient_X[feat].iloc[0]), 3)
                    if feat in patient_X.columns else None,
            }
            for feat, val in contributions
        ],
        "interpretation": _human_readable(contributions),
    }


def _human_readable(contributions: list) -> str:
    top = [f for f, v in contributions if v > 0][:3]
    if not top:
        return "No significant risk factors identified."
    labels = {
        "lead_days": "appointment booked far in advance",
        "no_show_rate": "history of missed appointments",
        "day_of_week": "appointment on a high-risk day",
        "hour": "appointment at a high-risk time",
        "specialty_enc": "high no-show specialty",
        "age": "age group risk factor",
        "is_video": "appointment type",
    }
    reasons = [labels.get(f, f.replace("_", " ")) for f in top]
    return f"Risk driven by: {', '.join(reasons)}."