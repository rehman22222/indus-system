from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import date
import traceback

from models.patient_volume_forecast import forecast_patient_volume
from models.risk_predictor import predict_patient_risks
from models.disease_predictor import predict_disease_patterns
from models.ensemble import run_ensemble_prediction
from models.model_trainer import train_all_models
from data.data_loader import load_patient_data, get_live_stats
from explainability.shap_explainer import get_shap_explanation
from realtime_dashboard.live_stats import get_current_stats

router = APIRouter()


@router.get("/forecast/volume")
async def volume_forecast(
    periods: int = Query(default=12, ge=1, le=24),
    specialty: Optional[str] = None,
):
    """
    Predict patient volume for next N months.
    Returns month-by-month forecast with confidence intervals.
    """
    try:
        result = await forecast_patient_volume(periods=periods, specialty=specialty)
        return {"success": True, "data": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/predict/risks")
async def patient_risks(
    limit: int = Query(default=100, ge=1, le=1000),
    risk_level: Optional[str] = Query(default=None),
):
    """
    Predict high-risk patients using XGBoost.
    Returns patient IDs with risk scores and top risk factors.
    """
    try:
        result = await predict_patient_risks(limit=limit, risk_level=risk_level)
        return {"success": True, "data": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/predict/diseases")
async def disease_patterns(
    target_date: Optional[str] = Query(default=None),
):
    """
    Predict common disease patterns using Random Forest.
    Returns specialty-level disease burden forecast.
    """
    try:
        result = await predict_disease_patterns(target_date=target_date)
        return {"success": True, "data": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/predict/ensemble")
async def ensemble(
    forecast_months: int = Query(default=12),
):
    """
    Full ensemble prediction — combines all models.
    Highest accuracy endpoint (95%+ target).
    """
    try:
        result = await run_ensemble_prediction(forecast_months=forecast_months)
        return {"success": True, "data": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/explain/{patient_id}")
async def explain_prediction(patient_id: str):
    """
    Returns SHAP explanation for why a patient was flagged high risk.
    """
    try:
        result = await get_shap_explanation(patient_id=patient_id)
        return {"success": True, "data": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/live")
async def live_stats():
    """
    Real-time stats for admin dashboard.
    """
    try:
        result = await get_current_stats()
        return {"success": True, "data": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/train")
async def trigger_training():
    """
    Manually trigger model retraining.
    Protected — only call from admin panel.
    """
    try:
        result = await train_all_models()
        return {"success": True, "message": "Training complete", "data": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/summary")
async def stats_summary():
    """
    Returns aggregate stats for admin overview cards.
    """
    try:
        result = await get_live_stats()
        return {"success": True, "data": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))