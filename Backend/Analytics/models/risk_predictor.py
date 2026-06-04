import pandas as pd
import numpy as np
import joblib
import os
from typing import Optional
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score
import xgboost as xgb
from utils.logger import get_logger
from data.data_loader import load_patient_data
from data.data_preprocessor import preprocess
from data.feature_engineer import build_features, get_feature_matrix

logger = get_logger(__name__)
MODEL_PATH = "saved_models/xgboost_risk.pkl"
SCALER_PATH = "saved_models/xgboost_scaler.pkl"


async def predict_patient_risks(
    limit: int = 100,
    risk_level: Optional[str] = None,
) -> dict:
    logger.info("Running XGBoost patient risk prediction...")

    df_raw = await load_patient_data(limit=200_000)
    if df_raw.is_empty():
        return {
            "patients": [],
            "model": "xgboost",
            "top_risk_factors": [],
            "total_high_risk": 0,
            "total_medium_risk": 0,
            "total_low_risk": 0,
        }

    df = preprocess(df_raw)
    df = build_features(df)
    X, y = get_feature_matrix(df)

    model, scaler = _load_or_train(X, y)

    X_scaled = scaler.transform(X.fillna(0))
    scores = model.predict_proba(X_scaled)[:, 1]

    df["risk_score"] = scores
    df["risk_label"] = pd.cut(
        scores,
        bins=[0, 0.35, 0.60, 1.0],
        labels=["low", "medium", "high"],
        include_lowest=True,  # a score of exactly 0.0 must land in "low", not NaN
    )

    if risk_level:
        result_df = df[df["risk_label"] == risk_level]
    else:
        result_df = df[df["risk_label"] == "high"]

    result_df = result_df.sort_values("risk_score", ascending=False).head(limit)

    # Top risk factors (feature importances mapped to patient)
    feature_names = X.columns.tolist()
    importances = model.feature_importances_
    top_features = sorted(
        zip(feature_names, importances), key=lambda x: x[1], reverse=True
    )[:5]

    return {
        "patients": [
            {
                "patient_id": str(row["patient_id"]),
                "risk_score": round(float(row["risk_score"]), 3),
                "risk_label": str(row["risk_label"]),
                "specialty": row.get("specialty", "Unknown"),
                "no_show_rate": round(float(row.get("no_show_rate", 0)), 3),
                "total_visits": int(row.get("total_visits", 0)),
            }
            for _, row in result_df.iterrows()
        ],
        "model": "xgboost",
        "top_risk_factors": [
            {"feature": f, "importance": round(float(i), 4)}
            for f, i in top_features
        ],
        "total_high_risk": int((df["risk_label"] == "high").sum()),
        "total_medium_risk": int((df["risk_label"] == "medium").sum()),
        "total_low_risk": int((df["risk_label"] == "low").sum()),
    }


def _load_or_train(X: pd.DataFrame, y: pd.Series):
    if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            scaler = joblib.load(SCALER_PATH)
            # Guard against a stale model whose feature set no longer matches
            # the current pipeline (e.g. after the feature list changed).
            # Retrain instead of crashing in scaler.transform / predict.
            expected = getattr(scaler, "n_features_in_", None)
            if expected is not None and expected != X.shape[1]:
                logger.warning(
                    "Saved model expects %s features but %s were provided; retraining.",
                    expected, X.shape[1],
                )
                return _train(X, y)
            logger.info("Loaded existing XGBoost model from disk")
            return model, scaler
        except Exception:
            pass

    return _train(X, y)


def _train(X: pd.DataFrame, y: pd.Series):
    logger.info(f"Training XGBoost on {len(X):,} samples...")

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X.fillna(0))

    pos = y.sum()
    neg = len(y) - pos
    scale = neg / pos if pos > 0 else 1

    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale,
        eval_metric="auc",
        random_state=42,
        n_jobs=-1,
        verbosity=0,
    )

    # Only stratify when every class has at least 2 samples; otherwise
    # train_test_split raises ValueError on tiny / single-class datasets.
    can_stratify = y.nunique() > 1 and y.value_counts().min() >= 2
    X_train, X_val, y_train, y_val = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42,
        stratify=y if can_stratify else None,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False,
    )

    # roc_auc_score is undefined when the validation set has a single class
    # (tiny/imbalanced data) — guard it so training doesn't crash.
    if len(np.unique(y_val)) > 1:
        auc = roc_auc_score(y_val, model.predict_proba(X_val)[:, 1])
        logger.info(f"XGBoost trained. AUC-ROC: {auc:.4f}")
    else:
        logger.warning("Validation set has a single class; skipping AUC-ROC.")

    os.makedirs("saved_models", exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)

    return model, scaler