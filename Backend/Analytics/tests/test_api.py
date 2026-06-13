from api.main import health


def test_health_payload_identifies_analytics_service():
    assert health() == {
        "status": "ok",
        "service": "Smart Care Hub Analytics",
    }
