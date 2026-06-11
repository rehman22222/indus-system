import os
from datetime import datetime

import polars as pl

from utils.logger import get_logger

logger = get_logger(__name__)

USE_MOCK = os.getenv("USE_MOCK_DATA", "false").lower() == "true"


def _id(value) -> str:
    return str(value) if value is not None else ""


def _status(value: str | None) -> str:
    if value == "no-show":
        return "no_show"
    return value or "confirmed"


def _risk_label(score: float) -> str:
    if score >= 0.7:
        return "high"
    if score >= 0.35:
        return "medium"
    return "low"


async def load_patient_data(limit: int = 10000) -> pl.DataFrame:
    if USE_MOCK:
        logger.warning("USE_MOCK_DATA is enabled. Returning empty dataframe fallback.")
        return pl.DataFrame([])

    try:
        from data.mongodb_client import get_mongo_db

        db = get_mongo_db()
        rows = []
        appointments = list(
            db.appointments.find({})
            .sort([("date", -1), ("time", -1)])
            .limit(limit)
        )

        doctor_ids = {a.get("doctor_id") for a in appointments if a.get("doctor_id")}
        patient_ids = {a.get("patient_id") for a in appointments if a.get("patient_id")}

        doctors = {
            d["_id"]: d
            for d in db.doctors.find({"_id": {"$in": list(doctor_ids)}})
        }
        patients = {
            p["_id"]: p
            for p in db.users.find({"_id": {"$in": list(patient_ids)}})
        }

        for appointment in appointments:
            doctor = doctors.get(appointment.get("doctor_id"), {})
            patient = patients.get(appointment.get("patient_id"), {})
            score = float(
                appointment.get("no_show_risk_score")
                or appointment.get("no_show_score")
                or 0.0
            )

            rows.append(
                {
                    "id": _id(appointment.get("_id")),
                    "patient_id": _id(appointment.get("patient_id")),
                    "patient_name": patient.get("name") or patient.get("full_name") or "Patient",
                    "doctor_id": _id(appointment.get("doctor_id")),
                    "appointment_date": appointment.get("date") or appointment.get("appointment_date") or "",
                    "appointment_time": appointment.get("time") or appointment.get("appointment_time") or "",
                    "appointment_type": appointment.get("appointment_type", "physical"),
                    "status": _status(appointment.get("status")),
                    "chief_complaint": appointment.get("chief_complaint"),
                    "no_show_risk_score": score,
                    "no_show_risk_label": appointment.get("no_show_risk_label") or _risk_label(score),
                    "created_at": appointment.get("created_at", ""),
                    "specialty": doctor.get("specialty", "General Medicine"),
                    "dob": patient.get("date_of_birth") or patient.get("dob") or "1990-01-01",
                    "blood_group": patient.get("blood_group", "O+"),
                }
            )

        logger.info(f"Total records loaded from MongoDB: {len(rows):,}")
        return pl.DataFrame(rows)

    except Exception as e:
        logger.error(f"MongoDB loading error: {e}")
        return pl.DataFrame([])


async def get_live_stats() -> dict:
    try:
        from data.mongodb_client import get_mongo_db

        db = get_mongo_db()
        today = datetime.now().date().isoformat()

        today_data = list(
            db.appointments.find(
                {"date": today},
                {"_id": 1, "status": 1, "appointment_type": 1},
            )
        )

        total_today = len(today_data)
        completed = sum(1 for a in today_data if a.get("status") == "completed")
        confirmed = sum(1 for a in today_data if a.get("status") == "confirmed")
        no_shows = sum(1 for a in today_data if a.get("status") in ("no-show", "no_show"))

        return {
            "today": {
                "total": total_today,
                "confirmed": confirmed,
                "completed": completed,
                "no_shows": no_shows,
                "no_show_rate": round(no_shows / total_today * 100, 1) if total_today else 0,
            },
            "totals": {
                "all_appointments": db.appointments.count_documents({}),
                "total_patients": db.users.count_documents({"role": "patient"}),
                "active_doctors": db.doctors.count_documents({"is_active": True}),
            },
        }
    except Exception as e:
        logger.error(f"Live stats failed: {e}")
        return {
            "today": {"total": 0, "confirmed": 0, "completed": 0, "no_shows": 0, "no_show_rate": 0},
            "totals": {"all_appointments": 0, "total_patients": 0, "active_doctors": 0},
        }
