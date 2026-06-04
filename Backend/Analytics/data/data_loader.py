import pandas as pd
import polars as pl
import numpy as np
import os
from datetime import datetime
from utils.logger import get_logger

logger = get_logger(__name__)

# Production: Disable mock data by default
USE_MOCK = os.getenv("USE_MOCK_DATA", "false").lower() == "true"


async def load_patient_data(limit: int = 10000) -> pl.DataFrame:
    if USE_MOCK:
        logger.warning("USE_MOCK_DATA is enabled. Using empty dataframe fallback if mock generation missing.")
        return pl.DataFrame([])

    # Live Supabase path
    try:
        from data.supabase_client import get_supabase
        supabase = get_supabase()
        rows = []
        batch_size = 1000
        offset = 0

        while offset < limit:
            fetch_count = min(batch_size, limit - offset)
            response = (
                supabase.table("appointments")
                .select(
                    "id, patient_id, doctor_id, appointment_date, "
                    "appointment_time, appointment_type, status, "
                    "chief_complaint, no_show_risk_score, no_show_risk_label, "
                    "created_at, doctors(specialty), patients(dob, blood_group)"
                )
                .range(offset, offset + fetch_count - 1)
                .execute()
            )
            batch = response.data or []
            if not batch:
                break

            for r in batch:
                rows.append({
                    "id": r.get("id", ""),
                    "patient_id": r.get("patient_id", ""),
                    "doctor_id": r.get("doctor_id", ""),
                    "appointment_date": r.get("appointment_date", ""),
                    "appointment_time": r.get("appointment_time", ""),
                    "appointment_type": r.get("appointment_type", "physical"),
                    "status": r.get("status", "confirmed"),
                    "chief_complaint": r.get("chief_complaint"),
                    "no_show_risk_score": float(r.get("no_show_risk_score") or 0.0),
                    "no_show_risk_label": r.get("no_show_risk_label") or "low",
                    "created_at": r.get("created_at", ""),
                    "specialty": (r.get("doctors") or {}).get("specialty", "General Medicine"),
                    "dob": (r.get("patients") or {}).get("dob", "1990-01-01"),
                    "blood_group": (r.get("patients") or {}).get("blood_group", "O+"),
                })

            offset += fetch_count
            logger.info(f"Loaded {len(rows):,} rows...")
            if len(batch) < fetch_count:
                break

        logger.info(f"Total records loaded from Supabase: {len(rows):,}")
        return pl.DataFrame(rows)

    except Exception as e:
        logger.error(f"Supabase loading error: {e}")
        return pl.DataFrame([])


async def get_live_stats() -> dict:
    try:
        from data.supabase_client import get_supabase
        supabase = get_supabase()
        today = datetime.now().date().isoformat()

        today_res = (
            supabase.table("appointments")
            .select("id, status, appointment_type")
            .eq("appointment_date", today)
            .execute()
        )
        total_res = supabase.table("appointments").select("id", count="exact").execute()
        patient_res = supabase.table("patients").select("id", count="exact").execute()
        doctor_res = (
            supabase.table("doctors")
            .select("id", count="exact")
            .eq("is_active", True)
            .execute()
        )

        today_data = today_res.data or []
        total_today = len(today_data)
        completed = sum(1 for a in today_data if a["status"] == "completed")
        confirmed = sum(1 for a in today_data if a["status"] == "confirmed")
        no_shows = sum(1 for a in today_data if a["status"] == "no_show")

        return {
            "today": {
                "total": total_today,
                "confirmed": confirmed,
                "completed": completed,
                "no_shows": no_shows,
                "no_show_rate": round(no_shows / total_today * 100, 1) if total_today else 0,
            },
            "totals": {
                "all_appointments": total_res.count or 0,
                "total_patients": patient_res.count or 0,
                "active_doctors": doctor_res.count or 0,
            },
        }
    except Exception as e:
        logger.error(f"Live stats failed: {e}")
        return {
            "today": {"total": 0, "confirmed": 0, "completed": 0, "no_shows": 0, "no_show_rate": 0},
            "totals": {"all_appointments": 0, "total_patients": 0, "active_doctors": 0},
        }
