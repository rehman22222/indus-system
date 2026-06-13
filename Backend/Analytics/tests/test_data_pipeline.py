import pandas as pd

from data.feature_engineer import build_features, get_feature_matrix


def test_feature_matrix_excludes_target_leakage_columns():
    rows = pd.DataFrame(
        [
            {
                "id": "a1",
                "patient_id": "p1",
                "doctor_id": "d1",
                "appointment_date": "2026-06-12",
                "specialty": "Cardiology",
                "year": 2026,
                "month": 6,
                "day_of_week": 4,
                "week_of_year": 24,
                "is_weekend": 0,
                "hour": 9,
                "is_video": 0,
                "lead_days": 3,
                "specialty_enc": 1,
                "age": 40,
                "age_group_enc": 2,
                "is_no_show": 0,
                "is_completed": 1,
            },
            {
                "id": "a2",
                "patient_id": "p1",
                "doctor_id": "d1",
                "appointment_date": "2026-06-12",
                "specialty": "Cardiology",
                "year": 2026,
                "month": 6,
                "day_of_week": 4,
                "week_of_year": 24,
                "is_weekend": 0,
                "hour": 10,
                "is_video": 1,
                "lead_days": 7,
                "specialty_enc": 1,
                "age": 40,
                "age_group_enc": 2,
                "is_no_show": 1,
                "is_completed": 0,
            },
        ]
    )

    engineered = build_features(rows)
    matrix, target = get_feature_matrix(engineered)

    assert "is_no_show" not in matrix.columns
    assert "no_show_rate" not in matrix.columns
    assert "completion_rate" not in matrix.columns
    assert target.tolist() == [0, 1]
